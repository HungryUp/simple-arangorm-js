const genericModel = require('./arangoModel');

const { db } = require('..');

/**
 * Create a model from schema provided
 *
 * @param schemaHandler
 * @param options
 * @returns {ArangoModel}
 */
module.exports = function arangoEdgeModel(schemaHandler, options) {
  const GenericModel = genericModel.call(this, schemaHandler, options);
  options = Object.assign(
    {
      name: 'generic',
      isEdge: false,
      db,
    },
    options,
  );
  const ArangoEdgeModel = class ArangoEdgeModel extends GenericModel {
    /**
     * Get collection instance of arangoDB
     */
    static get collection() {
      return options.db.edgeCollection(options.name);
    }

    async link(from, to, { unique } = {}) {
      if (unique) {
        const { updated } = await ArangoEdgeModel.collection.updateByExample(
          { _from: from.id, _to: to.id },
          this._validatedData || {},
        );
        if (updated) {
          return this;
        }
      }
      await ArangoEdgeModel.collection.save(this._validatedData || {}, from.id, to.id);
      return this;
    }

    static async createUniqueLink(from, to, data) {
      const o = new ArangoEdgeModel(data);
      return o.link(from, to, { unique: true });
    }
  };
  ArangoEdgeModel.setup();
  return ArangoEdgeModel;
};
