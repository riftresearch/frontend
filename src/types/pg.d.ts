declare module "pg" {
  export interface QueryResult<Row = any> {
    rows: Row[];
  }

  export class Client {
    constructor(config?: { connectionString?: string } & Record<string, any>);
    connect(): Promise<void>;
    end(): Promise<void>;
    query<Row = any>(text: string, params?: any[]): Promise<QueryResult<Row>>;
  }
}
