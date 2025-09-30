declare module 'expo-sqlite' {
  export interface SQLError {
    code: number;
    message: string;
  }

  export interface SQLResultSetRowList {
    length: number;
    item: (index: number) => any;
    _array: any[];
  }

  export interface SQLResultSet {
    insertId?: number;
    rowsAffected: number;
    rows: SQLResultSetRowList;
  }

  export interface SQLTransaction {
    executeSql(
      sqlStatement: string,
      args?: (string | number | null)[],
      callback?: (transaction: SQLTransaction, resultSet: SQLResultSet) => void,
      errorCallback?: (transaction: SQLTransaction, error: SQLError) => boolean | void,
    ): void;
  }

  export interface WebSQLDatabase {
    transaction(
      callback: (transaction: SQLTransaction) => void,
      error?: (error: SQLError) => void,
      success?: () => void,
    ): void;
  }

  export function openDatabase(
    name?: string,
    version?: string,
    description?: string,
    size?: number,
    callback?: () => void,
  ): WebSQLDatabase;
}
