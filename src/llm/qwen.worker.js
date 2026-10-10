// WebLLM runs here, off the main thread. ./qwen.js drives it with
// CreateWebWorkerMLCEngine; this handler speaks WebLLM's own message protocol.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
