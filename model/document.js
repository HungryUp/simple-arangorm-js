const genericModel = require('./arangoModel');
const qb = require('aqb');

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
    static async find(example = {}, { offset = 0, limit = 100 } = {}) {
      const query = await ArangoDocumentModel.collection.byExample(example, { skip: offset, limit });
      const array = await query.all();
      return array.map(o => new this(o, { isNew: false }));
    }

    /**
     * Find first matching document in ArangoDB
     *
     * @param example
     * @returns {Promise.<GenericModel>}
     */
    static async findOne(example) {
      const data = await this.collection.firstExample(example);
      const object = new this(data, { isNew: false });
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
      return this.findOne(criteria);
    }

    /**
     * Update current document
     *
     * @param saveOptions
     * @returns {Promise.<*>}
     */
    async save(saveOptions = {}) {
      saveOptions = Object.assign({ returnNew: true, validate: true, newKey: false }, saveOptions);

      await this.emit('save.before.validating_data', this);
      const validatedData = saveOptions.validate ? this._validatedData : this._data;
      if (saveOptions.newKey) {
        validatedData._key = saveOptions.newKey === true ? this.key : saveOptions.newKey;
      }
      await this.emit('save.after.validating_data', this);

      await this.emit('save.before', this);
      let result;
      if (this.key && !validatedData._key) {
        result = await ArangoDocumentModel.collection.update(this._documentHandle, validatedData, saveOptions);
      } else {
        result = await ArangoDocumentModel
          .collection
          .save(validatedData, saveOptions);
      }

      if (result.new) {
        await this.emit('save.before.merge', result.new);
        this.merge(result.new);
      }
      this.key = result._key;
      this.revision = result._rev;
      return result;
    }

    static async count(filters = {}) {
      const COL_NAME = 'col';
      const COUNTER = 'count';
      let queryBuilder = qb.for(COL_NAME).in(this.collection.name);
      if (this.buildCountFilters || this.buildFilters) {
        queryBuilder = (this.buildCountFilters || this.buildFilters)(queryBuilder, filters);
      }
      queryBuilder = queryBuilder.collectWithCountInto(COUNTER).return(COUNTER);
      const query = await this.query(queryBuilder);
      const [count] = await query.all();
      return count;
    }
  };
  return ArangoDocumentModel;
};
