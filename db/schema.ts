import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const players = sqliteTable('players', {
  id: text('id').primaryKey(), nickname: text('nickname').notNull(),
  tokenHash: text('token_hash').notNull().unique(), createdAt: text('created_at').notNull()
}, t => [uniqueIndex('players_nickname').on(sql`${t.nickname} COLLATE NOCASE`)]);
export const dailyScores = sqliteTable('daily_scores', {
  date: text('date').notNull(), playerId: text('player_id').notNull().references(() => players.id),
  moves: integer('moves').notNull(), createdAt: text('created_at').notNull()
}, t => [primaryKey({ columns: [t.date, t.playerId] }), index('daily_ranking').on(t.date, t.moves)]);
export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(), playerId: text('player_id').notNull().references(() => players.id),
  seed: text('seed').notNull(), round: integer('round').notNull(), cleared: integer('cleared').notNull(),
  ended: integer('ended').notNull(), createdAt: text('created_at').notNull()
}, t => [index('runs_player').on(t.playerId), uniqueIndex('one_active_run').on(t.playerId).where(sql`${t.ended} = 0`)]);
export const rounds = sqliteTable('rounds', {
  runId: text('run_id').notNull().references(() => runs.id), round: integer('round').notNull(),
  pathHash: text('path_hash').notNull(), response: text('response').notNull()
}, t => [primaryKey({ columns: [t.runId, t.round] })]);
export const rateLimits = sqliteTable('rate_limits', {
  bucket: text('bucket').primaryKey(), hits: integer('hits').notNull(), expires: integer('expires').notNull()
}, t => [index('rate_expiry').on(t.expires)]);
