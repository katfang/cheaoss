/* eslint-disable */
// @ts-nocheck

import { reboot_native, ensureError } from "@reboot-dev/reboot";


import {
  MessagesRequest,
  MessagesResponse,
  SendRequest,
  SendResponse,
} from "./hello_pb";

// Additionally re-export all messages_and_enums from the pb module.
export {
  MessagesRequest,
  MessagesResponse,
  SendRequest,
  SendResponse,
};

import {
  Hello as HelloProto,
} from "./hello_pb";

import * as uuid from "uuid";

import * as reboot from "@reboot-dev/reboot";
import {
  Context,
  ExternalContext,
  WorkflowContext,
  ReaderContext,
  WriterContext,
  TransactionContext,
} from "@reboot-dev/reboot";
import * as protobuf_es from "@bufbuild/protobuf";
import * as reboot_api from "@reboot-dev/reboot-api";


// To support writers seeing partial updates of transactions,
// and transactions seeing updates from writers, we need to store
// a reference to the latest state in an ongoing transaction.
//
// Moreover, we need to update that _reference_ after each writer
// executes within a transaction. We do that in the generated
// code, see below.
const ongoingTransactionStates: { [id: string] : any; } = {};

const ERROR_TYPES = [
  // gRPC errors.
  reboot_api.errors_pb.Cancelled,
  reboot_api.errors_pb.Unknown,
  reboot_api.errors_pb.InvalidArgument,
  reboot_api.errors_pb.DeadlineExceeded,
  reboot_api.errors_pb.NotFound,
  reboot_api.errors_pb.AlreadyExists,
  reboot_api.errors_pb.PermissionDenied,
  reboot_api.errors_pb.ResourceExhausted,
  reboot_api.errors_pb.FailedPrecondition,
  reboot_api.errors_pb.Aborted,
  reboot_api.errors_pb.OutOfRange,
  reboot_api.errors_pb.Unimplemented,
  reboot_api.errors_pb.Internal,
  reboot_api.errors_pb.Unavailable,
  reboot_api.errors_pb.DataLoss,
  reboot_api.errors_pb.Unauthenticated,
  // Reboot errors.
  //
  // NOTE: also add any new errors into `rbt/v1alpha1/index.ts`.
  reboot_api.errors_pb.StateAlreadyConstructed,
  reboot_api.errors_pb.StateNotConstructed,
  reboot_api.errors_pb.TransactionParticipantFailedToPrepare,
  reboot_api.errors_pb.TransactionParticipantFailedToCommit,
  reboot_api.errors_pb.UnknownService,
  reboot_api.errors_pb.UnknownTask,
] as const; // Need `as const` to ensure TypeScript infers this as a tuple!


type HelloRequestTypes =
        MessagesRequest
        | SendRequest
;

const HELLO_MESSAGES_ERROR_TYPES = [
  ...ERROR_TYPES,
  // Method errors.
] as const; // Need `as const` to ensure TypeScript infers this as a tuple!

type HelloMessagesAbortedError =
  reboot_api.InstanceTypeForErrorTypes<
    typeof HELLO_MESSAGES_ERROR_TYPES
  >[number];

const HELLO_SEND_ERROR_TYPES = [
  ...ERROR_TYPES,
  // Method errors.
] as const; // Need `as const` to ensure TypeScript infers this as a tuple!

type HelloSendAbortedError =
  reboot_api.InstanceTypeForErrorTypes<
    typeof HELLO_SEND_ERROR_TYPES
  >[number];



export abstract class HelloServicer extends reboot.Servicer<Hello.State> {
  static __rbtModule__ = "hello.v1.hello_rbt";
  static __servicerNodeAdaptor__ = "HelloServicerNodeAdaptor";

  // External reference to the native `Servicer`.
  #external?: any | undefined;

  protected ref(
    options?: { bearerToken?: string }
  ) {
    const context = reboot.getContext();
    return new Hello.WeakReference(context.stateId, options?.bearerToken);
  }

  abstract messages(
    context: ReaderContext,
    state: Hello.State,
    request: MessagesRequest,
  ): Promise<
  MessagesResponse | protobuf_es.PartialMessage<MessagesResponse>
  >;

  async _Messages(
    context: ReaderContext,
    jsonState: string,
    jsonRequest: string
  ): Promise<string> {
    try {
      let state = Hello.State.fromJsonString(
        jsonState
      );
      const response = await reboot.runWithContext(context, () => {
        return this.messages(
          context,
          state,
          MessagesRequest.fromJsonString(jsonRequest)
        );
      });
      return JSON.stringify({
        response
      });
    } catch (e) {
      if (e instanceof reboot_api.Aborted) {
        return JSON.stringify({
          status: e.toStatus()
        });
      }

      // Ensure we have an `Error` and then `console.error()` it so
      // that developers see a stack trace of what is going on.
      //
      // Only do this if it IS NOT an `Aborted` which we handle above.
      const error = ensureError(e);
      // Write an empy message which includes a newline to make it
      // easier to identify the stack trace.
      console.error("");
      console.error(error);
      console.error("");
      console.error(
        `Unhandled error in 'hello.v1.Hello.messages'; propagating as 'Unknown'\n`
      );

      throw error;
    }
  }

  abstract send(
    context: WriterContext,
    state: Hello.State,
    request: SendRequest,
  ): Promise<
  SendResponse | protobuf_es.PartialMessage<SendResponse>
  >;

  async _Send(
    context: WriterContext,
    jsonState: string,
    jsonRequest: string
  ): Promise<string> {
    try {
      let state = Hello.State.fromJsonString(
        jsonState
      );
      if (context.stateId in ongoingTransactionStates) {
        state = ongoingTransactionStates[context.stateId].clone();
      }
      const response = await reboot.runWithContext(context, () => {
        return this.send(
          context,
          state,
          SendRequest.fromJsonString(jsonRequest)
        );
      });
      // TODO: it's premature to overwrite the state now given that the
      // writer might still "fail" and an error will get propagated back
      // to the ongoing transaction which will still see the effects of
      // this writer. What we should be doing instead is creating a
      // callback API that we invoke only after a writer completes
      // that lets us update the state _reference_ then.
      if (context.stateId in ongoingTransactionStates) {
        ongoingTransactionStates[context.stateId].copyFrom(state);
      }
      return JSON.stringify({
        effects: new Hello.SendEffects({ state, response })
      });
    } catch (e) {
      if (e instanceof reboot_api.Aborted) {
        return JSON.stringify({
          status: e.toStatus()
        });
      }

      // Ensure we have an `Error` and then `console.error()` it so
      // that developers see a stack trace of what is going on.
      //
      // Only do this if it IS NOT an `Aborted` which we handle above.
      const error = ensureError(e);
      // Write an empy message which includes a newline to make it
      // easier to identify the stack trace.
      console.error("");
      console.error(error);
      console.error("");
      console.error(
        `Unhandled error in 'hello.v1.Hello.send'; propagating as 'Unknown'\n`
      );

      throw error;
    }
  }


  __storeExternal(external: any) {
    this.#external = external;
  }

  get __external() {
    if (this.#external === undefined) {
      throw new Error(`Unexpected undefined external`);
    }
    return this.#external;
  }

  authorizer(): reboot.Authorizer<Hello.State, HelloRequestTypes> | reboot.AuthorizerRule<Hello.State, HelloRequestTypes> | null {
    return null;
  }

  _authorizer() {
    // Get authorizer, if any, converting from a rule if necessary.
    const authorizer = ((authorizerOrRule) => {
      if (authorizerOrRule instanceof reboot.AuthorizerRule) {
        return new HelloAuthorizer({ _default: authorizerOrRule });
      }
      return authorizerOrRule;
    })(this.authorizer());

    if (authorizer !== null) {
      authorizer._authorize = async function(
        methodName: string,
        context: ReaderContext,
        bytesState?: Uint8Array,
        bytesRequest?: Uint8Array
      ): Promise<Uint8Array> {
        let state: Hello.State | undefined = undefined;
        if (bytesState !== undefined) {
          state = Hello.State.fromBinary(bytesState);
        }
        let request: HelloRequestTypes | undefined  = undefined;
        const anyRequest = protobuf_es.Any.fromBinary(bytesRequest);
        if (anyRequest.is(MessagesRequest)) {
          request = new MessagesRequest();
          anyRequest.unpackTo(request);
        } else if (anyRequest.is(SendRequest)) {
          request = new SendRequest();
          anyRequest.unpackTo(request);
        } else {
          throw new Error(`Unexpected type for ${request}: ${anyRequest.typeUrl}.`);
        }
        return protobuf_es.Any.pack(
          await authorizer.authorize(methodName, context, state, request)
        ).toBinary();
      };
    }
    return authorizer;
  }

  static _State = class {

    #servicer: HelloServicer

    constructor(servicer: HelloServicer) {
      this.#servicer = servicer;
    }

    async read(
      context: reboot.WorkflowContext
    ): Promise<Hello.State> {
      return Hello.State.fromJsonString(
        await reboot_native.Servicer_read(
          this.#servicer.__external,
          context.__external
        )
      );
    }

    async write(
      idempotencyAlias: string,
      context: reboot.WorkflowContext,
      writer: (state: Hello.State) => Promise<void>,
      options?: {
        stringify?: undefined;
        parse?: undefined;
        validate?: undefined
      }
    ): Promise<void>;

    async write<T>(
      idempotencyAlias: string,
      context: reboot.WorkflowContext,
      writer: (state: Hello.State) => Promise<T>,
      options: {
        stringify?: (result: T) => string;
        parse: (value: string) => T;
        validate?: undefined;
      } | {
        stringify?: (result: T) => string;
        parse?: undefined;
        validate: (result: T) => boolean;
      }
    ): Promise<T>;

    async write<T>(
      idempotencyAlias: string,
      context: reboot.WorkflowContext,
      writer: (state: Hello.State) => Promise<T>,
      options: {
        stringify?: (result: T) => string;
        parse?: (value: string) => T;
        validate?: (result: T) => boolean
      } = {}
    ): Promise<void | T> {
      return await this.idempotently(idempotencyAlias)
        .write(context, writer, options);
    }

    static _Idempotently = class {

      #external: any;
      #options: reboot_api.IdempotencyOptions;

      constructor(external: any, options: reboot_api.IdempotencyOptions) {
        this.#external = external;
        this.#options = options;
      }

      async write(
        context: reboot.WorkflowContext,
        writer: (state: Hello.State) => Promise<void>,
        options?: {
          stringify?: undefined;
          parse?: undefined;
          validate?: undefined
        },
        unidempotently?: boolean
      ): Promise<void>;

      async write<T>(
        context: reboot.WorkflowContext,
        writer: (state: Hello.State) => Promise<T>,
        options: {
          stringify?: (result: T) => string;
          parse: (value: string) => T;
          validate?: undefined;
        } | {
          stringify?: (result: T) => string;
          parse?: undefined;
          validate: (result: T) => boolean;
        },
        unidempotently?: boolean
      ): Promise<T>;

      async write<T>(
        context: reboot.WorkflowContext,
        writer: (state: Hello.State) => Promise<T>,
        {
          stringify = JSON.stringify,
          parse = JSON.parse,
          validate
        }: {
          stringify?: (result: T) => string;
          parse?: (value: string) => T;
          validate?: (result: T) => boolean
        },
        unidempotently: boolean = false,
      ): Promise<void | T> {
        const result = await reboot_native.Servicer_write(
          this.#external,
          context.__external,
          async (jsonState: string) => {
            const state = Hello.State.fromJsonString(
              jsonState
            );
            try {
              const t = await writer(state);

              // Fail early if the developer thinks that they have some value
              // that they want to validate but we got `undefined`.
              if (t === undefined && validate !== undefined) {
                throw new Error(
                  "Not expecting `validate` as you are returning `void` (or explicitly `undefined`); did you mean to return a value (or if you want to explicitly return the absence of a value use `null`)"
                );
              }

              return JSON.stringify({
                // NOTE: we use the empty string to represent a
                // `callable` returning `void` (or explicitly
                // `undefined`).
                //
                // To differentiate returning `void` (or explicitly
                // `undefined`) from `stringify` returning an empty
                // string we use `{ value: stringify(t) }`.
                result: (
                  t !== undefined && JSON.stringify({ value: stringify(t) })
                ) || "",
                state,
              });
            } catch (e) {
              throw ensureError(e);
            }
          },
          JSON.stringify({ idempotency: this.#options, unidempotently }),
        );

        // NOTE: we parse and validate `value` every time, even the first
        // time, so as to catch bugs where the `value` returned from
        // `callable` might not parse or be valid. We will have already
        // persisted `result`, so in the event of a bug the developer will
        // have to change the idempotency alias so that `callable` is
        // re-executed. These semantics are the same as Python (although
        // Python uses the `type` keyword argument instead of the
        // `parse` and `validate` properties we use here).

        // TODO: assert(result !== undefined);

        if (result !== "") {
          const { value } = JSON.parse(result);
          const t = parse(value);
          if (!unidempotently) {
            if (parse !== JSON.parse) {
              if (validate === undefined) {
                throw new Error("Missing `validate` property");
              } else if (!validate(t)) {
                throw new Error("Failed to validate memoized result");
              }
            }
          }
          return t;
        }

        // TODO: assert(result === "");

        // Otherwise `callable` must have returned void (or explicitly
        // `undefined`), fall through.
      }
    };

    public idempotently(aliasOrOptions: string | reboot_api.IdempotencyOptions) {
      const options = (typeof aliasOrOptions === "string" || aliasOrOptions instanceof String)
        ? { alias: aliasOrOptions }
        : aliasOrOptions;
      if (options.alias === undefined && options.key === undefined) {
        throw new Error(
          "Inline writers require either an idempotency alias or key"
        );
      }
      return new HelloServicer._State._Idempotently(
        this.#servicer.__external,
        options,
      );
    }

    static _Unidempotently = class {

      #external: any;

      constructor(external: any) {
        this.#external = external;
      }

      async write(
        context: reboot.WorkflowContext,
        writer: (state: Hello.State) => Promise<void>
      ): Promise<void>;

      async write<T>(
        context: reboot.WorkflowContext,
        writer: (state: Hello.State) => Promise<T>
      ): Promise<T>;

      async write<T>(
        context: reboot.WorkflowContext,
        writer: (state: Hello.State) => Promise<T>
      ): Promise<T> {
        return new HelloServicer._State._Idempotently(
          this.#external,
          { key: uuid.v4() }
        ).write<T>(
          context,
          writer,
          {},
          true
        );
      }
    };

    public unidempotently() {
      return new HelloServicer._State._Unidempotently(
        this.#servicer.__external
      );
    }
  };

  get state() {
    return new HelloServicer._State(this);
  }
}

export type HelloAuthorizerRules = {
  messages?: reboot.AuthorizerRule<Hello.State, MessagesRequest>;
  send?: reboot.AuthorizerRule<Hello.State, SendRequest>;
};

export class HelloAuthorizer extends reboot.Authorizer<Hello.State, HelloRequestTypes> {

  #rules: HelloAuthorizerRules & {
    _default: reboot.AuthorizerRule<Hello.State, protobuf_es.Message>;
  };

  constructor(
    rules: HelloAuthorizerRules & {
      _default?: reboot.AuthorizerRule<Hello.State, protobuf_es.Message>;
    }
  ) {
    super();
    this.#rules = { ...rules, _default: rules._default ?? reboot.allowIf({ all: [ reboot.isAppInternal ] }) };
  }

  async authorize(
    methodName: string,
    context: ReaderContext,
    state?: Hello.State,
    request?: HelloRequestTypes
  ): Promise<reboot.AuthorizerDecision> {
    if (methodName == 'hello.v1.HelloMethods.Messages') {
      return await this.messages(
        context,
        state,
        request as MessagesRequest,
      );
    } else if (methodName == 'hello.v1.HelloMethods.Send') {
      return await this.send(
        context,
        state,
        request as SendRequest,
      );
    } else {
      return new reboot_api.errors_pb.PermissionDenied();
    }
  }

  async messages(
    context: ReaderContext,
    state: Hello.State,
    request: MessagesRequest,
  ): Promise<reboot.AuthorizerDecision> {
    return await (
      this.#rules.messages ?? this.#rules._default
    ).execute({
      context,
      state,
      request: request as MessagesRequest,
    });
  }
  async send(
    context: ReaderContext,
    state: Hello.State,
    request: SendRequest,
  ): Promise<reboot.AuthorizerDecision> {
    return await (
      this.#rules.send ?? this.#rules._default
    ).execute({
      context,
      state,
      request: request as SendRequest,
    });
  }
}


export class HelloState extends HelloProto {

  static fromBinary(
    bytes: Uint8Array,
    options?: Partial<protobuf_es.BinaryReadOptions>
  ) {
    const state = new Hello.State();
    state.fromBinary(bytes, options);
    return state;
  }

  static fromJson(
    jsonValue: protobuf_es.JsonValue,
    options?: Partial<protobuf_es.JsonReadOptions>
  ) {
    const state = new Hello.State();
    state.fromJson(jsonValue, options);
    return state;
  }

  static fromJsonString(
    jsonString: string,
    options?: Partial<protobuf_es.JsonReadOptions>
  ) {
    const state = new Hello.State();
    state.fromJsonString(jsonString, options);
    return state;
  }

  public clone() {
    const state = new Hello.State();
    state.copyFrom(super.clone());
    return state;
  }

  public copyFrom(that: Hello.State | HelloProto) {
    // Unfortunately, protobuf-es does not have `CopyFrom` like Python
    // or C++ protobuf. Instead, protobuf-es has `fromJson` but it
    // performs a merge. Thus, we have to first clear all of the fields
    // in the message before calling `fromJson`.
    reboot.clearFields(this);
    this.fromJson(that.toJson());
  }
}




export class HelloMessagesAborted extends reboot_api.Aborted {
  static fromStatus(status: reboot_api.Status) {
    let error = reboot_api.errorFromGoogleRpcStatusDetails(
      status,
      HELLO_MESSAGES_ERROR_TYPES,
    );

    if (error !== undefined) {
      return new Hello.MessagesAborted(
        error, { message: status.message }
      );
    }

    error = reboot_api.errorFromGoogleRpcStatusCode(status);

    // TODO(benh): also consider getting the type names from
    // `status.details` and including that in `message` to make
    // debugging easier.

    return new Hello.MessagesAborted(
      error, { message: status.message }
    );
  }

  public toStatus(): reboot_api.Status {
    const isObject = (value: unknown): value is object => {
      return typeof value === 'object';
    };

    const isArray = (value: unknown): value is any[]  => {
      return Array.isArray(value);
    };

    const error = this.error.toJson();

    if (!isObject(error) || isArray(error)) {
      throw new Error("Expecting 'error' to be an object (and not an array)");
    }

    const detail = { ...error };
    detail["@type"] = `type.googleapis.com/${this.error.getType().typeName}`;

    return new reboot_api.Status({
      code: this.code,
      message: this.#message,
      details: [detail]
    });
  }

  constructor(
    error: HelloMessagesAbortedError,
    { message }: { message?: string } = {}
  ) {
    super();

    // Set the name of this error for even more information!
    this.name = this.constructor.name;

    this.error = error;

    let code = reboot_api.grpcStatusCodeFromError(this.error);

    if (code === undefined) {
      // Must be one of the Reboot specific errors.
      code = reboot_api.StatusCode.ABORTED;
    }

    this.code = code;

    this.#message = message;
  }

  toString(): string {
    return `${this.name}: ${this.message}`;
  }

  get message(): string {
    return `${this.error.getType().typeName}${this.#message ? ": " + this.#message : ""}`;
  }

  readonly error: HelloMessagesAbortedError;
  readonly code: reboot_api.StatusCode;
  readonly #message?: string;
}

export class HelloMessagesTask {

  readonly taskId: reboot_api.tasks_pb.TaskId;

  #promise: Promise<MessagesResponse>;

  private constructor(
    context: reboot.WorkflowContext | reboot.ExternalContext,
    taskId: reboot_api.tasks_pb.TaskId
  ) {
    this.taskId = taskId;
    this.#promise = new Promise(async (resolve, reject) => {
      const json = JSON.parse(
        await reboot_native.Task_await({
          context: context.__external,
          rbtModule: "hello.v1.hello_rbt",
          stateName: "Hello",
          method: "Messages",
          jsonTaskId: JSON.stringify(taskId),
        })
      );

      if ("status" in json) {
        reject(
          Hello
            .MessagesAborted
            .fromStatus(reboot_api.Status.fromJson(json["status"]))
        );
      } else {
        // TODO: assert("response" in json)
        resolve(MessagesResponse.fromJson(json["response"]));
      }
    });
  }

  static retrieve(
    context: reboot.WorkflowContext | reboot.ExternalContext,
    { taskId }: { taskId: reboot_api.tasks_pb.TaskId }
  ) {
    return new HelloMessagesTask(
      context, taskId
    );
  }

  then(...args: Parameters<Promise<MessagesResponse>["then"]>) {
    return this.#promise.then(...args);
  }
}


export class HelloSendAborted extends reboot_api.Aborted {
  static fromStatus(status: reboot_api.Status) {
    let error = reboot_api.errorFromGoogleRpcStatusDetails(
      status,
      HELLO_SEND_ERROR_TYPES,
    );

    if (error !== undefined) {
      return new Hello.SendAborted(
        error, { message: status.message }
      );
    }

    error = reboot_api.errorFromGoogleRpcStatusCode(status);

    // TODO(benh): also consider getting the type names from
    // `status.details` and including that in `message` to make
    // debugging easier.

    return new Hello.SendAborted(
      error, { message: status.message }
    );
  }

  public toStatus(): reboot_api.Status {
    const isObject = (value: unknown): value is object => {
      return typeof value === 'object';
    };

    const isArray = (value: unknown): value is any[]  => {
      return Array.isArray(value);
    };

    const error = this.error.toJson();

    if (!isObject(error) || isArray(error)) {
      throw new Error("Expecting 'error' to be an object (and not an array)");
    }

    const detail = { ...error };
    detail["@type"] = `type.googleapis.com/${this.error.getType().typeName}`;

    return new reboot_api.Status({
      code: this.code,
      message: this.#message,
      details: [detail]
    });
  }

  constructor(
    error: HelloSendAbortedError,
    { message }: { message?: string } = {}
  ) {
    super();

    // Set the name of this error for even more information!
    this.name = this.constructor.name;

    this.error = error;

    let code = reboot_api.grpcStatusCodeFromError(this.error);

    if (code === undefined) {
      // Must be one of the Reboot specific errors.
      code = reboot_api.StatusCode.ABORTED;
    }

    this.code = code;

    this.#message = message;
  }

  toString(): string {
    return `${this.name}: ${this.message}`;
  }

  get message(): string {
    return `${this.error.getType().typeName}${this.#message ? ": " + this.#message : ""}`;
  }

  readonly error: HelloSendAbortedError;
  readonly code: reboot_api.StatusCode;
  readonly #message?: string;
}

export class HelloSendTask {

  readonly taskId: reboot_api.tasks_pb.TaskId;

  #promise: Promise<SendResponse>;

  private constructor(
    context: reboot.WorkflowContext | reboot.ExternalContext,
    taskId: reboot_api.tasks_pb.TaskId
  ) {
    this.taskId = taskId;
    this.#promise = new Promise(async (resolve, reject) => {
      const json = JSON.parse(
        await reboot_native.Task_await({
          context: context.__external,
          rbtModule: "hello.v1.hello_rbt",
          stateName: "Hello",
          method: "Send",
          jsonTaskId: JSON.stringify(taskId),
        })
      );

      if ("status" in json) {
        reject(
          Hello
            .SendAborted
            .fromStatus(reboot_api.Status.fromJson(json["status"]))
        );
      } else {
        // TODO: assert("response" in json)
        resolve(SendResponse.fromJson(json["response"]));
      }
    });
  }

  static retrieve(
    context: reboot.WorkflowContext | reboot.ExternalContext,
    { taskId }: { taskId: reboot_api.tasks_pb.TaskId }
  ) {
    return new HelloSendTask(
      context, taskId
    );
  }

  then(...args: Parameters<Promise<SendResponse>["then"]>) {
    return this.#promise.then(...args);
  }
}




export class HelloWeakReference {
  #external: any;
  #id: string;
  #options?: reboot_api.CallOptions;

  constructor(id: string, bearerToken?: string) {
    this.#id = id;
    this.#options = {
      bearerToken: bearerToken,
    };
    this.#external = reboot_native.Service_constructor({
      rbtModule: "hello.v1.hello_rbt",
      nodeAdaptor: "HelloWeakReferenceNodeAdaptor",
      id: this.#id,
    });
  }

  get stateId(): string {
    return this.#id;
  }

  async __externalServiceCallMessages(
    context: Context | ExternalContext,
    partialRequest?: protobuf_es.PartialMessage<MessagesRequest>,
    options?: reboot_api.CallOptions
  ): Promise<any> {
    const request = partialRequest instanceof MessagesRequest ?
      partialRequest : new MessagesRequest(partialRequest);

    const json = JSON.parse(
      await reboot_native.Service_call({
        external: this.#external,
        kind: "reader",
        method: "Messages",
        requestModule: "hello.v1.hello_pb2",
        requestType: "MessagesRequest",
        context: context.__external,
        jsonRequest: JSON.stringify(request || {}),
        jsonOptions: JSON.stringify(options || {}),
      })
    );

    if ("status" in json) {
      throw Hello
        .MessagesAborted
        .fromStatus(reboot_api.Status.fromJson(json["status"]));
    }

    return json;
  }

  async messages(
    context: ReaderContext | WriterContext | TransactionContext | WorkflowContext | ExternalContext,
    partialRequest?: protobuf_es.PartialMessage<MessagesRequest>,
  ): Promise<MessagesResponse> {
    const json = await this.__externalServiceCallMessages(
      context,
      partialRequest,
      this.#options,
    );

    // TODO: assert("response" in json)

    return MessagesResponse.fromJson(json["response"]);
  }

  async __externalServiceCallSend(
    context: Context | ExternalContext,
    partialRequest?: protobuf_es.PartialMessage<SendRequest>,
    options?: reboot_api.CallOptions
  ): Promise<any> {
    const request = partialRequest instanceof SendRequest ?
      partialRequest : new SendRequest(partialRequest);

    const json = JSON.parse(
      await reboot_native.Service_call({
        external: this.#external,
        kind: "writer",
        method: "Send",
        requestModule: "hello.v1.hello_pb2",
        requestType: "SendRequest",
        context: context.__external,
        jsonRequest: JSON.stringify(request || {}),
        jsonOptions: JSON.stringify(options || {}),
      })
    );

    if ("status" in json) {
      throw Hello
        .SendAborted
        .fromStatus(reboot_api.Status.fromJson(json["status"]));
    }

    return json;
  }

  async send(
    context: TransactionContext | WorkflowContext | ExternalContext,
    partialRequest?: protobuf_es.PartialMessage<SendRequest>,
  ): Promise<SendResponse> {
    const json = await this.__externalServiceCallSend(
      context,
      partialRequest,
      this.#options,
    );

    // TODO: assert("response" in json)

    return SendResponse.fromJson(json["response"]);
  }


  static _Idempotently = class {

    #weakReference: any;
    #options: reboot_api.CallOptions;

    constructor(
      weakReference: any,
      options: reboot_api.CallOptions
    ) {
      this.#weakReference = weakReference;
      this.#options = options;
    }

    async send(
      context: reboot.TransactionContext | reboot.WorkflowContext | reboot.ExternalContext,
      partialRequest?: protobuf_es.PartialMessage<SendRequest>
    ): Promise<SendResponse> {
      const json = await this.#weakReference.__externalServiceCallSend(
        context,
        partialRequest,
        this.#options,
      );

       // TODO: assert("response" in json)

       return SendResponse.fromJson(json["response"]);
    }


    public schedule(options?: reboot_api.ScheduleOptions) {
      return new Hello.WeakReference._Schedule(
        this.#weakReference,
        {
          ...this.#options,
          schedule: options || { when: new Date() }
        },
      );
    }

    public spawn(options?: reboot_api.ScheduleOptions) {
      return new Hello.WeakReference._Spawn(
        this.#weakReference,
        {
          ...this.#options,
          schedule: options || { when: new Date() }
        },
      );
    }
  };

  public idempotently(aliasOrOptions: string | reboot_api.IdempotencyOptions = {} as reboot_api.IdempotencyOptions) {
    const idempotency = (typeof aliasOrOptions === "string" || aliasOrOptions instanceof String) ? { alias: aliasOrOptions } : aliasOrOptions;
    return new Hello.WeakReference._Idempotently(
      this,
      {
        ...this.#options,
        idempotency: idempotency,
      },
    );
  }

  public unidempotently() {
    return this.idempotently({ key: uuid.v4() });
  }

  static _Schedule = class {

    #weakReference: any;
    #options: reboot_api.CallOptions;

    constructor(
      weakReference: any,
      options: reboot_api.CallOptions,
    ) {
      this.#weakReference = weakReference;
      this.#options = options;
    }

    async messages(
      context: reboot.WriterContext | reboot.TransactionContext,
      partialRequest?: protobuf_es.PartialMessage<MessagesRequest>
    ): Promise<reboot_api.tasks_pb.TaskId> {
      const json = await this.#weakReference.__externalServiceCallMessages(
        context,
        partialRequest,
        this.#options,
      );

      // TODO: assert("taskId" in json)

      const taskId = reboot_api.tasks_pb.TaskId.fromJson(json["taskId"]);

      return taskId;
    }

    async send(
      context: reboot.WriterContext | reboot.TransactionContext,
      partialRequest?: protobuf_es.PartialMessage<SendRequest>
    ): Promise<reboot_api.tasks_pb.TaskId> {
      const json = await this.#weakReference.__externalServiceCallSend(
        context,
        partialRequest,
        this.#options,
      );

      // TODO: assert("taskId" in json)

      const taskId = reboot_api.tasks_pb.TaskId.fromJson(json["taskId"]);

      return taskId;
    }


  };

  public schedule(options?: reboot_api.ScheduleOptions) {
    return new Hello.WeakReference._Schedule(
      this,
      {
        ...this.#options,
        schedule: options || { when: new Date() }
      },
    );
  }

  static _Spawn = class {

    #weakReference: any;
    #options: reboot_api.CallOptions;

    constructor(
      weakReference: any,
      options: reboot_api.CallOptions,
    ) {
      this.#weakReference = weakReference;
      this.#options = options;
    }

    async messages(
      context: reboot.WorkflowContext | reboot.ExternalContext,
      partialRequest?: protobuf_es.PartialMessage<MessagesRequest>
    ): Promise<{ task: HelloMessagesTask }> {
      const json = await this.#weakReference.__externalServiceCallMessages(
        context,
        partialRequest,
        this.#options,
      );

      // TODO: assert("taskId" in json)

      const taskId = reboot_api.tasks_pb.TaskId.fromJson(json["taskId"]);

      return {
        task: Hello.MessagesTask
          .retrieve(context, { taskId })
      };
    }

    async send(
      context: reboot.WorkflowContext | reboot.ExternalContext,
      partialRequest?: protobuf_es.PartialMessage<SendRequest>
    ): Promise<{ task: HelloSendTask }> {
      const json = await this.#weakReference.__externalServiceCallSend(
        context,
        partialRequest,
        this.#options,
      );

      // TODO: assert("taskId" in json)

      const taskId = reboot_api.tasks_pb.TaskId.fromJson(json["taskId"]);

      return {
        task: Hello.SendTask
          .retrieve(context, { taskId })
      };
    }


  };

  public spawn(options?: reboot_api.ScheduleOptions) {
    return new Hello.WeakReference._Spawn(
      this,
      {
        ...this.#options,
        schedule: options || { when: new Date() }
      },
    );
  }
}

export class Hello {

  static Servicer = HelloServicer;
  static State = HelloState;
  static Authorizer = HelloAuthorizer;
  static WeakReference = HelloWeakReference;


  static MessagesAborted = HelloMessagesAborted;

  static MessagesTask = HelloMessagesTask;



  static SendAborted = HelloSendAborted;

  static SendTask = HelloSendTask;

  static SendEffects = class {
    state: HelloProto;
    response: SendResponse;

    constructor(effects: {
      state: protobuf_es.PartialMessage<HelloProto>;
      response: protobuf_es.PartialMessage<SendResponse>;
    }) {
      this.state = effects.state instanceof HelloProto
        ? effects.state
        : new HelloProto(effects.state);

      this.response = effects.response instanceof SendResponse
        ? effects.response
        : new SendResponse(effects.response);
    }
  };


  public static ref(
    id: string,
    options?: { bearerToken?: string }
  ) {
    return new Hello.WeakReference(id, options?.bearerToken);
  }


  public static idempotently(aliasOrOptions: string | reboot_api.IdempotencyOptions = {} as reboot_api.IdempotencyOptions) {
    const idempotency = (typeof aliasOrOptions === "string" || aliasOrOptions instanceof String) ? { alias: aliasOrOptions } : aliasOrOptions;
    return new Hello._ConstructIdempotently(idempotency);
  }

  static _ConstructIdempotently = class {
    #idempotency: reboot_api.IdempotencyOptions;

    constructor(idempotency: reboot_api.IdempotencyOptions) {
      this.#idempotency = idempotency;
    }

  };
}

export namespace Hello {
  export type MessagesAborted = typeof Hello.MessagesAborted.prototype;
}
export namespace Hello {
  export type SendAborted = typeof Hello.SendAborted.prototype;
}

export namespace Hello {
  export type SendTask = typeof Hello.SendTask.prototype;
  export type SendEffects = typeof Hello.SendEffects.prototype;
}


export namespace Hello {
  export type RequestTypes = HelloRequestTypes;
  export type WeakReference = typeof Hello.WeakReference.prototype;
  export type State = typeof Hello.State.prototype;
}


export function importPys() {

    reboot_native.importPy("hello.v1.hello_pb2", "H4sIAAAAAAAC/61WW2/aMBR+51d49AE6rcEx5VIkpHYlayuVywjdSzNFCTYQKYmz2FTtfv2OnYRbKYNpDy2+fDefnoN6hi4+X6App0E876ClnF201UnpDN2xmKWeZBT5b0guGEpSLvmUh8hfzmYsBVKUBCFLDYR6QzQYTpDVe5h8Aqrgy3TKOmjBwpDXXsyaXhhaAK5H6hNE0OhNLniMfrBUBDzuoIZBmoZZKpfLa/P3rpQZgCjNUh6hOefzkGXKSjGIEp5KRJmYpkEieYo8gdz19kiWm3Bw3Kbqs4N88Rb5PHSpJz3fE0zzd8728o0gliyNvbAQ8pdBSFmWPV9D2a6vs1q4QSxYKqFiEAmo1YwlzkslZedSH3XfGRs9NvOWoawCKguR+tJ4Mb0wWXhmYcwTJSvcxCfKHCAu5dItYHpTYBQItHqWfTt+GE2GY+W6U661q3FDqc3SwAuD34x+g76p+hUndl7Ny31dAufEecXt7OjFhL2nfiBRrUhTy5PkjPK5ksONe0XJ+MBRR+2ICeHNmYCTNuxNBL/qVUeONy87sLl0XtvA8xs5EjtlWJlaZdbPgWP2a8mEdMqGzo/X5yKBOOwfvMFGFwP7NotpYZDptPVFK4duypi5zOoOwmKm4dNMJwsEKlealF3pAvUZjB5VqchDFrS/Dqpsr4yi9sbuw/O/xT5AXgEVpLlTS6JtsJLv6uWlypi7NdZi2xVQTs3dy4MuWeeAT1N9NnVz1CtqOOYh971QQJ/mKxiGYr6Mr+ozf8hNTK14GfVWzSyq6zb/ggqhXfaEJxsUECnqssWurB6jF2qMKpuawQzFXG6OkuE+2ZZ7665V7E4JvnRXW8MNuUcZLWYTXjjgMQNMIftcce+tx8dh5edpWLEa2Q08DC6BQpNmw8F17GCMK3vofWtyP+zZoBJlveb6b27sRey5UtTllDRHyh0XWPXi6bFV8/2nyIXUsXExIR8F3pER0ktlt0n+joQIXRPXt4F9y7Zv7ix7bH1/suzJXnETN04haR9CPqLYo+HAtvYbkcuTWNqphbc5tjXoHXxNixxLUPrENPfBD7yCmPWjGdqBtA420x6HOj6aoRzqbXLo/4mI02XIXDHlCTsv/QFK0LdNIgoAAA==");
    reboot_native.importPy("hello.v1.hello_pb2_grpc", "H4sIAAAAAAAC/+1XS3PbNhC+81cgzoHSVKFjN+nBU3WqkRlHHVvWSErbGwYiVxJaimAA0Lbq8X/vAiBpPSg5jpWZzjQ8SHzsA/vt7ofFa3IBKUimISaTJdFzILPhoEsGSz0XKcmk0CISCYnEIuMJSJIl+YynATm/Jv3rMQnPe+NX3tHRUTfhkGrC0pgokDcoGSVMKVCoKiWoTKQxT2dEC2d0kk/fxDDlKTgFHoEK0I7HF5mQmsxkFpX3t0ymqKs8byrFgswhSURwc0KKz/aZZpNTwlTxEAtNb07sn3thPnveBYZGL8J+OOyMw3P6ezgc9a77pE38k+Cnd8GPvpN4fG9WEVCK4SguUkq98M9B2DW64XB4PaTD8DLsjMLCwvvgre+Nuh/D80+XKFJ8pOfozEj8lqdATt+3yOnb03e+V1lNcZUqz0wsCEabfGCJAs/TcnnmEbxs0G4lueYJ1xxRLWKfcql0ZYkrmohbkFZtp/16ncZq6C1SD1XTg7sIMk161n0opZBn+72NZY7B8OkOCaddZjgwNw37ykbuj01BYugkY9HfbAaEp0qzJEHTXBGmSWGU3K8u/6HlVzZ+QCtkkmtX21WxRyI2xly9HN+cHFdVRC3U2ZLEkEEaKyLSDWtGgItf2vf1ID0EG/KDBJgCkmczydDrUuTSBbUQcZ6A6YmnTG5YFJLE4jZdtbceWa5Mszmrb7QQifq5vQ7R5iLHcwS0yAO55UlCJoBdD9jSBEyeDVr39fW/hbeK5mBCi8kUFSU4AEya6tsDV9OqLAzzVPMF/OHWYl83Pc+zfEI+mjRdAbJTrEY6nzTE5C+IdNPVERLIFVc2dhQWEbeIxCLKF8hOTJtKwaDMgwknsFSEDZGA5R5rA1mJUMpTriltKEimLRLNWZpCUjgpHHUFlqLMIy1k4FUfOnKmHsXMVSifkY5r4q57DlZtVffGX3AFSmGtK+yeQjnIUyaX1P421qybyz8uKTFYhee4tLOCbXlJ+JwDsgBSL2cJ/wdkew9zVisaOrVgVKqNxUhLhLvOg+F8BTSGZztxmsEHJL5d5qmEGVcaJMR0YeNtG6ZpriM5wgZ+KYrGxssRNFa+KXrOwUuQq20xtzXLb9NmZcaLNisgxX4TqYY7vd5vL/FY9aIzHCjQ1PBkw3bkCA3kqovPwad+72pwGV6FfSS5Zq1eDJrxRDV8BxHB7czsxgkY5xC/8h/VJONIe32he4/f7Z65T7lCx2T0OzKryHgGFhbHtK5EqRbUjZ6NYqCUrWIWLeDCiIqKp0gIMY6zhmLv1zrEr0jzzNH1CmfQbQPbNOK4x/mvKK1VK1ZSyFcwpCOSfW2+xiJfy8BPMFVz/dG3VHkI3IyhA2G2SryHxmuNc78Mqwf7a6c1HpVolCeNjeKkG2LroPm125Xfqitz13iuGQLTQKVlI1sKNRob/lrNLb2tveNR+3nrQZp77WZOt+ngTcbwQCOmZuA0Y+awZ7imc0k6g15QszUdfkv6VRnByK11e5MqSXgtC5rJGWy8E5lxp9qNjf4oxhAaIXy4DqwW1e6LFDak8HjzhAgegiDKJbTtUXFDHU/qWMfmUFSjectwrMWZHBPJ4mWNgJm8Ra5rviAsLGaa2U8rG5AEncvUFTDcZVhAFvE909YXA/nMwfaAE+xB5tSiDp4sgvrk7q+KnUnfl+/aVNdnef3t7plxd9/Y8eV7z/xXeqbmGHOg88qLTyX/gz75FwcdyvhoFQAA");
    reboot_native.importPy("hello.v1.hello_rbt", "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");
}

importPys()
