'use strict';

const supabase = require('./supabase');

module.exports = {
  supabase,

  /**
   * Returns a Supabase query builder for the given table.
   * Usage: const { data, error } = await db.query('sessions').select('*');
   */
  query(table) {
    return supabase.from(table);
  },

  /**
   * Calls a PostgreSQL function (RPC) through Supabase.
   * Usage: const { data, error } = await db.rpc('my_function', { arg1: 'val' });
   */
  async rpc(fn, params) {
    return supabase.rpc(fn, params);
  },
};
