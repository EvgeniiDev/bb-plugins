import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  BUILTIN_THREAD_LIST_PROVIDER,
  DOCKSIDE_THREAD_LIST_PROVIDER,
  THREAD_LIST_PROVIDER_KEY,
  isDocksideProvider,
  readThreadListProvider,
  selectBuiltinThreadList,
  toggleThreadList,
  threadListProviderFrom,
} from "../lib/thread-list-provider.ts";

/** A stand-in for bb's /api/v1/preferences/ui endpoints. */
function fakeServer(initial: { value: unknown; revision: number }, opts: { conflict?: boolean } = {}) {
  const state = { ...initial };
  const writes: Array<{ value: unknown; expectedRevision: number }> = [];
  let conflicts = opts.conflict ? 1 : 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.endsWith("/api/v1/preferences/ui")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      writes.push(body);
      if (conflicts > 0) {
        conflicts -= 1;
        state.revision += 1;
        return new Response("conflict", { status: 409 });
      }
      state.value = body.value;
      state.revision = body.expectedRevision + 1;
      return new Response(JSON.stringify({ key: THREAD_LIST_PROVIDER_KEY, ...state }), { status: 200 });
    }
    return new Response(
      JSON.stringify({ preferences: { [THREAD_LIST_PROVIDER_KEY]: { ...state } } }),
      { status: 200 },
    );
  }) as typeof fetch;
  return {
    state,
    writes,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

afterEach(() => {
  // each test restores its own fake in its body
});

describe("thread list provider preference", () => {
  it("treats __automatic__ and dockside as Dockside, anything else as built-in", () => {
    assert.equal(threadListProviderFrom(undefined), "__automatic__");
    assert.equal(threadListProviderFrom(""), "__automatic__");
    assert.equal(isDocksideProvider("__automatic__"), true);
    assert.equal(isDocksideProvider(DOCKSIDE_THREAD_LIST_PROVIDER), true);
    assert.equal(isDocksideProvider(BUILTIN_THREAD_LIST_PROVIDER), false);
  });

  it("reads the provider bb stores", async () => {
    const server = fakeServer({ value: DOCKSIDE_THREAD_LIST_PROVIDER, revision: 5 });
    try {
      assert.equal(await readThreadListProvider(), DOCKSIDE_THREAD_LIST_PROVIDER);
    } finally {
      server.restore();
    }
  });

  it("returns false instead of throwing when bb is unreachable", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    try {
      assert.equal(await readThreadListProvider(), null);
      assert.equal(await toggleThreadList(), false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("writes the built-in provider with the revision it just read", async () => {
    const server = fakeServer({ value: DOCKSIDE_THREAD_LIST_PROVIDER, revision: 5 });
    try {
      assert.equal(await selectBuiltinThreadList(), true);
      assert.deepEqual(server.writes.at(-1), {
        expectedRevision: 5,
        value: BUILTIN_THREAD_LIST_PROVIDER,
      });
      assert.equal(server.state.value, BUILTIN_THREAD_LIST_PROVIDER);
    } finally {
      server.restore();
    }
  });

  it("retries once after a 409 so a revision bump does not lose the click", async () => {
    const server = fakeServer(
      { value: DOCKSIDE_THREAD_LIST_PROVIDER, revision: 5 },
      { conflict: true },
    );
    try {
      assert.equal(await toggleThreadList(), true);
      assert.equal(server.writes.length, 2);
      assert.equal(server.state.value, BUILTIN_THREAD_LIST_PROVIDER);
    } finally {
      server.restore();
    }
  });
});
