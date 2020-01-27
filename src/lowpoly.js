class LowPoly {
  static addMappings(name, mapping) {
    return Object.assign({}, mapping, {
      "max-amplitude": name + ".maxAmplitude",
      "min-amplitude": name + ".minAmplitude",
      seed: name + ".seed"
    });
  }
  static addSchema(schema) {
    return Object.assign({}, schema, {
      maxAmplitude: { default: { x: 0.1, y: 0.1, z: 0.1 }, type: "vec3" },
      minAmplitude: { default: { x: 0, y: 0, z: 0 }, type: "vec3" },
      amplitudePDF: { default: p => p },
      seed: { default: "apples" },
      flatShading: { default: true }
    });
  }
  static create(that, createGeometry) {
    const data = that.data,
      el = that.el;
    let material = el.components.material;
    let geometry = createGeometry(data);
    geometry.mergeVertices();
    LowPoly.randomizeVertices(data, geometry);
    if (!material) {
      material = {};
      material.material = new THREE.MeshPhongMaterial();
    }
    if (data.flatShading) {
      material.material.setValues({ flatShading: true });
    }
    that.mesh = new THREE.Mesh(geometry, material.material);
    el.setObject3D("mesh", that.mesh);
  }
  static randomizeVertices(data, geometry) {
    Random.seed(data.seed);
    for (let v, i = 0, l = geometry.vertices.length; i < l; i++) {
      v = geometry.vertices[i];
      LowPoly.randomizeVertexDimension(
        v,
        "x",
        data.amplitudePDF,
        data.maxAmplitude.x,
        data.minAmplitude.x
      );
      LowPoly.randomizeVertexDimension(
        v,
        "y",
        data.amplitudePDF,
        data.maxAmplitude.y,
        data.minAmplitude.y
      );
      LowPoly.randomizeVertexDimension(
        v,
        "z",
        data.amplitudePDF,
        data.maxAmplitude.z,
        data.minAmplitude.z
      );
    }
    geometry.verticesNeedUpdate = true;
  }
  static randomizeVertexDimension(
    vertex,
    dim,
    amplitudePDF,
    maxAmplitude,
    minAmplitude
  ) {
    let p = amplitudePDF(Random.random()),
      ori = "o" + dim,
      amp = (maxAmplitude - minAmplitude) * p + minAmplitude;
    if (!(ori in vertex)) {
      vertex[ori] = vertex[dim];
    }
    vertex[dim] = vertex[ori] + amp;
  }
}
class LowPolyFactory {
  static simple(geometryName, createGeometry, properties) {
    var extendDeep = AFRAME.utils.extendDeep;
    var meshMixin = AFRAME.primitives.getMeshMixin();
    var defaultComponents = {};
    var componentName = "low-poly-" + geometryName;
    defaultComponents[componentName] = {};
    var primitiveMapping = {};
    var componentSchema = {};
    for (const [key, value] of Object.entries(properties)) {
      var keyCamelCase = hyphenatedToCamel(key);
      primitiveMapping[key] = componentName + "." + keyCamelCase;
      componentSchema[keyCamelCase] = { default: value };
    }
    AFRAME.registerPrimitive(
      "lp-" + geometryName,
      extendDeep({}, meshMixin, {
        defaultComponents: defaultComponents,
        mappings: LowPoly.addMappings(componentName, primitiveMapping)
      })
    );
    AFRAME.registerComponent(componentName, {
      schema: LowPoly.addSchema(componentSchema),
      play: function() {
        LowPoly.create(this, createGeometry);
      },
      update: function() {
        LowPoly.create(this, createGeometry);
      },
      remove: function() {
        this.el.removeObject3D("mesh");
      }
    });
  }
}
class LowPolyTerrain {
  static registerCurvature(componentName, computePosition) {
    AFRAME.registerComponent(componentName, {
      init: function() {
        this.curvature_initialized = false;
      },
      tick: function(time, delta) {
        if (!this.curvature_initialized) {
          this.curvature_initialized = true;
          LowPolyTerrain.updateCurvature(this, computePosition);
        }
      }
    });
  }
  static updateCurvature(that, computePosition) {
    var geometry = that.el.getObject3D("mesh").geometry;
    var min = LowPolyTerrain.computeMinPosition(geometry.vertices);
    var max = LowPolyTerrain.computeMaxPosition(geometry.vertices);
    for (let v, i = 0, l = geometry.vertices.length; i < l; i++) {
      v = geometry.vertices[i];
      var position = computePosition(v, min, max);
      v.x = position.x;
      v.y = position.y;
      v.z = position.z;
      v.ox = position.x;
      v.oy = position.y;
      v.oz = position.z;
    }
    geometry.verticesNeedUpdate = true;
  }
  static computeMinPosition(vertices) {
    var min = { x: Infinity, y: Infinity, z: Infinity };
    for (let v, i = 0, l = vertices.length; i < l; i++) {
      v = vertices[i];
      min.x = Math.min(v.x, min.x);
      min.y = Math.min(v.y, min.y);
      min.z = Math.min(v.z, min.z);
    }
    return min;
  }
  static computeMaxPosition(vertices) {
    var max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (let v, i = 0, l = vertices.length; i < l; i++) {
      v = vertices[i];
      max.x = Math.max(v.x, max.x);
      max.y = Math.max(v.y, max.y);
      max.z = Math.max(v.z, max.z);
    }
    return max;
  }
}
AFRAME.registerComponent("clone", {
  schema: { type: "selector" },
  init: function() {
    var clone = this.data.object3D.clone(true);
    clone.visible = true;
    this.el.setObject3D("clone", clone);
  }
});
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
function lowercaseFirstLetter(string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
}
function hyphenatedToCamel(hyphenated) {
  return lowercaseFirstLetter(
    hyphenated
      .split("-")
      .map(token => capitalizeFirstLetter(token))
      .join("")
  );
}
class Random {
  static seed(seed) {
    var seed = Random.xfnv1a(seed.toString());
    this.random = Random.mulberry32(seed());
  }
  static xfnv1a(k) {
    for (var i = 0, h = 2166136261 >>> 0; i < k.length; i++)
      h = Math.imul(h ^ k.charCodeAt(i), 16777619);
    return function() {
      h += h << 13;
      h ^= h >>> 7;
      h += h << 3;
      h ^= h >>> 17;
      return (h += h << 5) >>> 0;
    };
  }
  static mulberry32(a) {
    return function() {
      var t = (a += 1831565813);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  static random() {
    return this.random();
  }
}
LowPolyFactory.simple("box", createBoxGeometry, {
  width: 1,
  height: 1,
  depth: 1,
  "segments-width": 10,
  "segments-height": 10,
  "segments-depth": 10
});
function createBoxGeometry(data) {
  return new THREE.BoxGeometry(
    data.width,
    data.height,
    data.depth,
    data.segmentsWidth,
    data.segmentsHeight,
    data.segmentsDepth
  );
}
LowPolyFactory.simple("circle", createCircleGeometry, {
  radius: 1,
  segments: 10,
  "theta-start": 0,
  "theta-length": 2 * Math.PI
});
function createCircleGeometry(data) {
  return new THREE.CircleGeometry(
    data.radius,
    data.segments,
    data.thetaStart,
    data.thetaLength
  );
}
LowPolyFactory.simple("cone", createConeGeometry, {
  radius: 1,
  height: 1,
  "segments-radial": 10,
  "segments-height": 10,
  "open-ended": false,
  "theta-start": 0,
  "theta-length": 2 * Math.PI
});
function createConeGeometry(data) {
  return new THREE.ConeGeometry(
    data.radius,
    data.height,
    data.segmentsRadial,
    data.segmentsHeight,
    data.openEnded,
    data.thetaStart,
    data.thetaLength
  );
}
LowPolyFactory.simple("cylinder", createCylinderGeometry, {
  "radius-top": 1,
  "radius-bottom": 1,
  height: 1,
  "segments-radial": 10,
  "segments-height": 10,
  "open-ended": false,
  "theta-start": 0,
  "theta-length": 2 * Math.PI
});
function createCylinderGeometry(data) {
  return new THREE.CylinderGeometry(
    data.radiusTop,
    data.radiusBottom,
    data.height,
    data.segmentsRadial,
    data.segmentsHeight,
    data.openEnded,
    data.thetaStart,
    data.thetaLength
  );
}
LowPolyFactory.simple("plane", createPlaneGeometry, {
  width: 1,
  height: 1,
  "segments-width": 10,
  "segments-height": 10
});
function createPlaneGeometry(data) {
  return new THREE.PlaneGeometry(
    data.width,
    data.height,
    data.segmentsWidth,
    data.segmentsHeight
  );
}
LowPolyFactory.simple("sphere", createSphereGeometry, {
  radius: 1,
  "segments-width": 10,
  "segments-height": 10,
  "phi-start": 0,
  "phi-length": 2 * Math.PI,
  "theta-start": 0,
  "theta-length": 2 * Math.PI
});
function createSphereGeometry(data) {
  return new THREE.SphereGeometry(
    data.radius,
    data.segmentsWidth,
    data.segmentsHeight,
    data.phiStart,
    data.phiLength,
    data.thetaStart,
    data.thetaLength
  );
}