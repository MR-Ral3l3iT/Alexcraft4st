import type { Server as SocketIoServer } from "socket.io";

declare global {
  // eslint-disable-next-line no-var -- augment global for custom server.mjs
  var __SOCKET_IO__: SocketIoServer | undefined;
}

export {};
