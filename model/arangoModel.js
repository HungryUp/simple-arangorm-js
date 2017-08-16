const Joi = require('joi');

const { db } = require('..');
const merge = require('lodash.merge');

/**
 * Create a model from schema provided
 *
 * @param schemaHandler
 * @param options
 * @returns {GenericModel}
 */
module.exports = function arangoModel(schemaHandler, options) {
  options = Object.assign(
    {
      name: 'generic',
      db,
    },
    options,
  );
  const schema = schemaHandler({ Joi }, options);
  const schemaKeys = Object.keys(schema);
  const GenericModel = class GenericModel {
    constructor(data) {
      for (const key of schemaKeys) {
        Object.defineProperty(this, key, {
          enumerable: true,
          get() {
            return this._data[key];
          },
          set(datum) {
            this._data[key] = datum;
          },
        });
      }
      for (const key of ['_key', '_id', '_rev']) {
        Object.defineProperty(this, key, {
          enumerable: true,
          get() {
            try {
              return this._documentHandle[key];
            } catch (e) {
              return null;
            }
          },
          set(datum) {
            this.addToDocumentHandle({ [key]: datum });
          },
        });
      }
      this._data = data;
      this.addToDocumentHandle(data);
    }

    static skeleton(data) {
      return new this(data);
    }

    /**
     * Create collection if not exists
     *
     * @returns {Promise.<void>}
     */
    static async setup() {
      try {
        await this.collection.get();
      } catch (e) {
        await this.collection.create();
      }
    }

    /**
     * Get collection instance of arangoDB
     */
    static get collection() {
      throw new Error('collection must be override');
    }

    /**
     * Validate data from Joi and return schema
     * @returns {*}
     * @private
     */
    get _validatedData() {
      const { error, value } = Joi.validate(this._data, schema, { stripUnknown: true });
      if (error) {
        throw error;
      }
      return value;
    }

    /**
     * Merge data in argument with data to sync
     *
     * @param data
     * @returns {GenericModel}
     */
    merge(data) {
      this._data = merge(this._data, data);
      this.addToDocumentHandle(data);
      return this;
    }

    /**
     * Add handler for save
     *
     * @param o
     */
    addToDocumentHandle(o) {
      this._documentHandle = Object.assign({}, this._documentHandle, o);
    }

    /**
     * Set revision
     *
     * @param revision
     */
    set revision(revision) {
      this.addToDocumentHandle({ _rev: revision });
    }

    get revision() {
      return (this._documentHandle || {})._rev || null;
    }

    /**
     * Set key
     *
     * @param key
     */
    set key(key) {
      this.addToDocumentHandle({ _key: key });
    }

    get key() {
      return (this._documentHandle || {})._key || null;
    }

    get id() {
      if (!this.key) {
        return null;
      }
      return `${options.name}/${this.key}`;
    }

    static get collectionName() {
      return options.name;
    }
  };
  return GenericModel;
};
