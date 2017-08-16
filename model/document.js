const genericModel = require('./arangoModel');

const { db } = require('..');

/**
 * Create a model from schema provided
 *
 * @param schemaHandler
 * @param options
 * @returns {ArangoModel}
 */
module.exports = function arangoDocumentModel(schemaHandler, options) {
  const GenericModel = genericModel.call(this, schemaHandler, options);
  options = Object.assign(
    {
      name: 'generic',
      isEdge: false,
      db,
    },
    options,
  );
  const ArangoDocumentModel = class ArangoDocumentModel extends GenericModel {
    /**
     * Get collection instance of arangoDB
     */
    static get collection() {
      return options.db.collection(options.name);
    }

    /**
     * Return cursor of entries
     * @returns {Promise.<void>}
     */
    static async find(example, { offset, limit }) {
      offset = offset || 0;
      limit = limit || 100;
      const query = await ArangoDocumentModel.collection.byExample(example, { skip: offset, limit });
      const array = await query.all();
      return array.map(o => new this(o));
    }

    /**
     * Find first matching document in ArangoDB
     *
     * @param example
     * @returns {Promise.<GenericModel>}
     */
    static async findOne(example) {
      const data = await ArangoDocumentModel.collection.firstExample(example);
      const object = new ArangoDocumentModel(data);
      object.revision = data._rev;
      object.key = data._key;
      return object;
    }

    /**
     * Find first document in ArangoDB with specified id
     *
     * @param id
     * @param revision
     * @returns {Promise.<GenericModel>}
     */
    static async findById(id, revision) {
      const criteria = { _key: id };
      if (revision) {
        criteria._rev = revision;
      }
      return ArangoDocumentModel.findOne(criteria);
    }

    /**
     * Update current document
     *
     * @param saveOptions
     * @returns {Promise.<*>}
     */
    async save(saveOptions = {}) {
      saveOptions = Object.assign({ returnNew: true }, saveOptions);

      let result;
      if (this._documentHandle) {
        result = await ArangoDocumentModel.collection.update(this._documentHandle, this._validatedData, saveOptions);
      } else {
        result = await ArangoDocumentModel
          .collection
          .save(this._validatedData, saveOptions);
      }

      if (result.new) {
        this.merge(result.new);
      }
      this.key = result._key;
      this.revision = result._rev;
      return result;
    }
  };
  ArangoDocumentModel.setup();
  return ArangoDocumentModel;
};
