import { DeepPartial, Repository, BaseEntity } from 'typeorm';
import { getPrimaryKey, getOneToMany, getRepo } from '../common';

import * as _ from 'lodash';

export interface ExplicitDeepList<T extends BaseEntity> {
  repo: Repository<T>;
  primaryKey: string;
  id: string;
}

/**
 *  Attempts to merge a monolith entity that will remove missing
 *  entries from a one-to-many relationship safely.
 *
 * @param repoitory Typeorm entity of type T
 * @param record Record to merge to
 * @param payload Record to merge with
 */
export async function explicitDeepMerge<T extends BaseEntity>(
  repoitory: Repository<T>,
  record: T,
  payload: DeepPartial<T>,
) {
  const partialMerge = repoitory.merge(record, payload);
  const stale = doExplicitDeepMerge<T>(record, payload, repoitory, []);
  await partialMerge.save();

  const staleData = await Promise.all(
    stale.map(x =>
      x.repo.findOne({ [x.primaryKey]: x[getPrimaryKey(x.repo)] }),
    ),
  );

  // TODO: Add option / mixin for soft-delete
  // Delete all stale data
  await Promise.all(staleData.map(x => x.remove()));
}

/**
 * Private function for recursive state lookups
 *
 * @param record Record to merge to
 * @param payload Record to merge with
 * @param repo Typeorm entity of type T
 * @param staleEntities Recursive collection of entities to remove and their types
 */
function doExplicitDeepMerge<T extends BaseEntity>(
  record: T,
  payload: DeepPartial<T>,
  repo: Repository<T>,
  staleEntities: ExplicitDeepList<T>[],
) {
  const pKey = getPrimaryKey(repo);
  // Get current 1->* column names and type
  const subRelations = getOneToMany(repo).map(x => ({
    ref: x.type,
    name: x.propertyName,
  }));
  for (const subRelation of subRelations) {
    if (record[subRelation.name] && record[subRelation.name].length > 0) {
      // Get the current repository for this subrelation
      const currentRepo = getRepo(subRelation.ref);

      // Find the missing records to implicitly delete
      const missing = _.differenceWith(
        record[subRelation.name],
        payload[subRelation.name],
        (a: T, b: T) => a[pKey] === b[pKey],
      );

      // Skip if nothing, recursively call all non-missing entities for further checks
      if (missing.length === 0) {
        record[subRelation.name]
          .map(x => ({
            a: x,
            b: payload[subRelation.name].find(r => r[pKey] === x[pKey]),
          }))
          .forEach(x =>
            doExplicitDeepMerge(x.a, x.b, currentRepo, staleEntities),
          );
        continue;
      }

      // Store all stale data meta in data structure to remove later
      staleEntities.push(
        ...missing.map(m => ({
          repo: currentRepo,
          primaryKey: pKey,
          id: m[pKey],
        })),
      );

      // Find all entities remaining that aren't to be removed
      const remainingPossibilities = (_.differenceWith(
        record[subRelation.name],
        missing,
        (a, b) => a[pKey] === b[pKey], // Assuming base entity class has an `id` field
      ) as T[]).map(x => ({
        a: x,
        b: payload[subRelation.name].find(p => p[pKey] === x[pKey]),
      }));

      remainingPossibilities.map(r =>
        this.doExplicitDeepMerge(r.a, r.b, currentRepo, staleEntities),
      );
    }
  }

  return staleEntities;
}
