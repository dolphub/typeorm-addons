import { Repository } from 'typeorm';
import * as _ from 'lodash';

import { getUniqueColumnNames } from '../common';

/**
 * Return type for violatesUnique
 */
export type Result<T> = [boolean, (keyof T)[] | undefined];

/**
 * This function checks all current entries
 * for unique violations on the specific entity
 *
 * @type  T - Entity type
 * @param _repository - Typeorm repository
 * @param payload - the payload to test
 *
 * @returns Result - Tuple of success and failures
 */
export async function violatesUnique<T>(
  _repository: Repository<T>,
  payload: Partial<T>,
): Promise<Result<T>> {
  // Get entity unique columns
  const uniquesColumns = getUniqueColumnNames<T>(_repository);
  if (!uniquesColumns.length) {
    return;
  }

  // Only build query against constraints that exist in payload
  const constraints = uniquesColumns.filter(u => !_.isEmpty(payload[u]));
  const q = _repository.createQueryBuilder('x');
  for (const c of constraints) {
    q.orWhere(`x.${c} = :${c}`, {
      [c]: payload[c],
    });
  }
  const results = await q.getMany();
  if (!results.length) {
    return;
  }
  // Get all violated constraint fields from payload
  const violations = constraints.filter(u =>
    results.find(result => result[u] === payload[u]),
  );
  return [false, violations];
}
