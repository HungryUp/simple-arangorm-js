const Joi = require('joi');

const merge = require('lodash.merge');
const pick = require('lodash.pick');
const clone = require('lodash.clone');
const dashify = require('dashify');
const { Database } = require('arangojs');

const dbSymbol = Symbol('db');

module.exports = class Abstract {
  constructor(data = {}) {
    this._data = data;
  }

  static mockId(key) {
    return `${this.collectionName}/${key}`;
  }

  static detachClass() {
    return clone(this);
  }

  static get schema() {
    return this.validationLib.object();
  }

  static get validationLib() {
    return Joi;
  }

  static get new() {
    return new this();
  }

  get proxy() {
    return new Proxy(this, {
      get: (target, key) => key in target._validatedData?
          target._validatedData[key] : target[key],
      set: function (target, key, value) {
        if (target[key]) {
          target[key] = value;
        } else {
          target._data[key] = value;
        }
      }
    });
  }

  /**
   * Get collection instance of arangoDB
   */
  static get collection() {
    throw new Error('collection must be override');
  }

  get collection() {
    return this.constructor.collection;
  }

  static get collectionName() {
    return dashify(this.name);
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

  static configure(dbConfig) {
    this.db = dbConfig;
    return this;
  }

  static get db() {
    return this[dbSymbol];
  }

  static set db(db) {
    if (typeof db === 'object') {
      if(!(db instanceof Database)) {
        db = new Database(db);
      }
    } else {
        db = new Database();
    }
    this[dbSymbol] = db;
  }

  static async query(...aql) {
    return this.db.query(...aql);
  }

  /**
   * Set revision
   *
   * @param revision
   */
  set revision(revision) {
    this._data._rev = revision;
  }

  get revision() {
    return this._data._rev;
  }

  /**
   * Set key
   *
   * @param key
   */
  set key(key) {
    this._data._key = key;
  }

  get key() {
    return this._data._key;
  }

  get id() {
    if (!this.key) {
      return undefined;
    }
    return this._data._id || this.constructor.mockId(this.key);
  }

  get _discriminators() {
    const data = pick(this._data, ['_key', '_rev', '_id']);
    if (!data._id) {
      data._id = this.id;
    }
    return data;
  }

  get _validatedData() {
    const { error, value } = this.constructor.validationLib
      .validate(this._data, this.constructor.schema);
    if (error) {
      throw error;
    }
    return value;
  }

  get _validatedContent() {
    const { error, value } = this.constructor.validationLib
      .validate(this._data, this.constructor.schema, { stripUnknown: true });
    if (error) {
      throw error;
    }
    return value;
  }

  replace(data) {
    this._data = data;
    return this;
  }

  withKey(key) {
    this._data._key = key;
    return this;
  }

  with(data) {
    merge(this._data, data);
    return this;
  }

  async remove() {
    return this.collection.remove(this._discriminators);
  }
};
