export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  __proto__: Error;
  context: SecurityRuleContext;
  
  constructor(context: SecurityRuleContext) {
    const prettyContext = JSON.stringify(context, null, 2);
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:\n${prettyContext}`;
    
    const trueProto = new.target.prototype;
    super(message);
    this.__proto__ = trueProto;
    this.context = context;
    this.name = 'FirestorePermissionError';
  }
}
