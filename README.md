# ⚡ Collaborative Text Editor (HTTP/2 WebSocket Baseline)

A high-performance, real-time collaborative text editor built as a VS Code Extension. This specific implementation utilizes an **HTTP/2 WebSocket architecture** to serve as a rigorous performance baseline for a thesis project. It is designed to be directly A/B tested against an HTTP/3 WebTransport implementation to measure the real-world impact of TCP Head-of-Line (HoL) blocking versus QUIC multiplexing on CRDT-based document synchronization.

### 🎥 Demo
[Link to Video]

---

## 🎯 Project Overview

Traditional collaborative editors rely on TCP-based WebSockets, which process network packets sequentially. In highly concurrent editing environments, this creates Application-Level Head-of-Line blocking—where heavy document mutations can stall lightweight cursor UI updates if packets are delayed. 

To scientifically measure this limitation, this extension implements a pure HTTP/2 WebSocket routing pipeline. State consistency is mathematically guaranteed via the **Yjs CRDT framework**. By benchmarking this baseline against an HTTP/3 WebTransport equivalent under identical network conditions, the project provides quantifiable data on latency, jitter, and transport efficiency for real-time collaboration.

---

## 🏗️️ Core Architectural Decisions

As part of the research and development of this extension, several critical distributed systems trade-offs were evaluated. 

### 1. Transport Architecture: Direct Node.js Client vs. Webview Proxy
* **The Problem:** The HTTP/3 implementation required a VS Code Webview HTML proxy to access browser-native WebTransport APIs, introducing Inter-Process Communication (IPC) latency via `postMessage`. 
* **The Decision (Chosen):** Implemented a direct **Node.js WebSocket Client** (`ws`). By eliminating the Webview proxy, the extension establishes a direct TCP socket connection from the VS Code background process to the server. This guarantees the lowest possible latency, ensuring the A/B performance test measures pure network transport limits rather than local IPC overhead.
* **Rejected Alternative:** Retaining the Webview proxy for WebSockets was rejected, as the artificial IPC latency would skew the baseline performance metrics.

### 2. Protocol Routing: Manual Upgrade Inspection
* **The Problem:** Binding a WebSocket server directly to an HTTP/2 secure server automatically hijacks all protocol upgrade requests, preventing the server from inspecting URLs and creating security vulnerabilities.
* **The Decision (Chosen):** Engineered a **Manual Upgrade Router**. The WebSocket server is instantiated in detached mode (`noServer: true`). The HTTP/2 server listens for the `upgrade` event, strictly verifies the target URL (`/yjs-router`), and only then executes `wss.handleUpgrade()`. Unauthorized paths are instantly severed at the socket level.

### 3. State Authority: The Smart Server Master Document
* **The Problem:** If the server acts as a "dumb megaphone" and merely forwards network packets, late-joining peers encounter a blank state, as they missed the historical typing data. Relying on connected peers to furnish this state introduces fatal race conditions if those peers disconnect.
* **The Decision (Chosen):** Implemented **Server Authority State Injection**. The Node.js server maintains a live, master `Y.Doc` for every active room. When a new user connects and initiates a handshake, the server immediately runs `Y.encodeStateAsUpdate()` and injects the complete document history directly into the new user's stream, instantly resolving the CRDT DAG.

### 4. Message Control Flow: Decoupled State Manipulation
* **The Problem:** Applying CRDT transformations (`Y.applyUpdate`) to every incoming network packet causes the server to crash when it receives ephemeral cursor movements (awareness data), which are not mathematically structured as text edits.
* **The Decision (Chosen):** Engineered a **Decoupled Routing Block**. The architecture strictly isolates state manipulation from the broadcast megaphone. Incoming packets are inspected: only text payloads (`type: 'doc'`) are processed by the server's master CRDT document. However, the broadcast loop executes unconditionally, ensuring both reliable text and ephemeral cursor frames are forwarded to all peers.

### 5. Workspace Routing: Dynamic Observer Rebinding
* **The Problem:** Scaling from a single shared document to a multi-file workspace required a structural overhaul of the AST (Abstract Syntax Tree). Linear arrays suffer from index-shifting and $O(N)$ lookup latency during rapid keypresses.
* **The Decision (Chosen):** Upgraded the CRDT to a 2D hierarchical dictionary (`Y.Map`), mapped natively to a custom VS Code `TreeDataProvider` Sidebar. To prevent cross-file memory leaks, the system utilizes **Dynamic Observer Rebinding**, safely detaching and re-attaching event listeners to specific file buffers strictly when the user navigates the virtual directory.

---

## 🚀 Getting Started

### Prerequisites
* [Visual Studio Code](https://code.visualstudio.com/) (v1.80+)
* [Node.js](https://nodejs.org/) (v18+)
* The companion HTTP/2 WebSocket Node.js Server

### Installation
1. Clone this repository:
   ```bash
   git clone [https://github.com/yourusername/vscode-crdt-collaborative-editor.git](https://github.com/yourusername/vscode-crdt-collaborative-editor.git)
2. install dependencies:
    ```bash

    npm install

3. Press F5 to compile and launch the extension in a new VS Code Extension Development Host window.

4. Open the Command Palette (Ctrl+Shift+P) and type Collaborative Text Editor: Manage Session to create or join a room.