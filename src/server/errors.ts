// Shared with database services so their validation can be tested without a Next request context.
export class HttpError extends Error {
  readonly status:number;
  readonly code:string;
  constructor(status:number,code:string,message:string){super(message);this.status=status;this.code=code;}
}
