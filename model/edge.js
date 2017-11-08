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
      const result = await ArangoEdgeModel.collection.save(this._validatedData || {}, from.id, to.id);
      this.key = result._key;
      this.revision = result._rev;
      return this;
    }

    async unlink() {
      await ArangoEdgeModel.collection.remove(this._documentHandle);
      return this;
    }

    static async findLinkedDocuments(from, TypeToDiscover/* , { offset, limit } */) {
      const traversal = await ArangoEdgeModel.collection.traversal(from.id, {
        direction: 'outbound',
        startVertex: from.id,
        filter: `if (vertex._id === "${from.id}" || !vertex._id.startsWith("${TypeToDiscover.collectionName}/")) {
        return "exclude";
        }
        return;`,
        edgeCollection: options.name,
        maxDepth: 1,
      });
      return traversal.visited.vertices.map(v => new TypeToDiscover(v));
    }

    static async findLinkedDocument(from, documentToDiscover) {
      const traversal = await ArangoEdgeModel.collection.traversal(from.id, {
        direction: 'outbound',
        startVertex: from.id,
        filter: `if (vertex._id !== "${documentToDiscover.id}") {
        return "exclude";
        }
        return;`,
        edgeCollection: options.name,
        maxDepth: 1,
      });
      try {
        const vertice = traversal.visited.vertices[0];
        documentToDiscover.merge(vertice);
        return documentToDiscover;
      } catch (e) {
        return null;
      }
    }

    static async createUniqueLink(from, to, data) {
      const o = new ArangoEdgeModel(data);
      return o.link(from, to, { unique: true });
    }
  };
  ArangoEdgeModel.setup();
  return ArangoEdgeModel;
};
