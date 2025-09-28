declare module 'react-native-sqlite-storage' {
  export type ResultSet = {
    insertId?: number;
    rowsAffected: number;
    rows: {
      length: number;
      item: (index: number) => any;
    };
  };

  export type Transaction = {
    executeSql: (
      sqlStatement: string,
      params?: any[],
      success?: (transaction: Transaction, resultSet: ResultSet) => void,
      error?: (transaction: Transaction, error: Error) => void,
    ) => Promise<void>;
  };

  export type SQLiteDatabase = {
    executeSql: (sqlStatement: string, params?: any[]) => Promise<[ResultSet]>;
    transaction: (callback: (transaction: Transaction) => void) => Promise<void>;
    close: () => Promise<void>;
  };

  const SQLite: {
    enablePromise: (value: boolean) => void;
    openDatabase: (options: {name: string; location: string}) => Promise<SQLiteDatabase>;
  };

  export default SQLite;
}

