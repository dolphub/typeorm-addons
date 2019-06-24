import { Repository } from 'typeorm';

/**
 * Returns an array of entties columns that are unique
 * @param repo Typeorm repository of type T
 */
export function getUniqueColumnNames<T>(repo: Repository<T>): [keyof T] {
  return repo.metadata.uniques.map(c => c.givenColumnNames[0]) as [keyof T];
}

// tslint:disable-next-line:ban-types
export function getRepo<T>(record: string | Function | (new () => T)) {
  return this._repository.manager.connection.getRepository(record);
}

/**
 * Returns the repositories list of one to many columns
 *
 * @param repo Typeorm respository of type T
 */
export function getOneToMany<T>(repo: Repository<T>) {
  return repo.metadata.oneToManyRelations;
}

/**
 * Returns the main primary key of an entity
 *
 * @param repo Typeorm respository of type T
 */
export function getPrimaryKey<T>(repo: Repository<T>) {
  // TODO: Double check for multiple primary keys?
  return repo.metadata.primaryColumns[0].propertyName;
}
