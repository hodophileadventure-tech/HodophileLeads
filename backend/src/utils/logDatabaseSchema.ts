type SchemaColumnRow = {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
};

export const logDatabaseSchema = async (queryFn: (text: string, params?: any[]) => Promise<any>) => {
  const tablesResult = await queryFn(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const columnsResult = await queryFn(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  const tables = Array.isArray(tablesResult.rows) ? tablesResult.rows.map((row: any) => row.table_name) : [];
  const columnsByTable = new Map<string, SchemaColumnRow[]>();

  for (const row of columnsResult.rows as SchemaColumnRow[]) {
    const current = columnsByTable.get(row.table_name) || [];
    current.push(row);
    columnsByTable.set(row.table_name, current);
  }

  console.log('[DB SCHEMA] Tables created:', tables.length);
  for (const tableName of tables) {
    const columns = columnsByTable.get(tableName) || [];
    const columnList = columns.map((column) => `${column.column_name}:${column.data_type}${column.is_nullable === 'NO' ? '!' : ''}`).join(', ');
    console.log(`[DB SCHEMA] ${tableName} (${columns.length} columns) -> ${columnList}`);
  }
};

export default logDatabaseSchema;