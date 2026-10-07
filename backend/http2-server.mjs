import http2 from 'node:http2'; 
import fs from 'node:fs';
import { WebSocketServer } from 'ws'; 
import * as Y from 'yjs';             
import path from 'node:path'

const activeRooms = new Map();

async function startHTTP2Server(){
    console.log('booting http2 server ....');
    try{
    const options = {
        key: fs.readFileSync(path.join(import.meta.dirname, 'localhost-privkey.pem')),
        cert: fs.readFileSync(path.join(import.meta.dirname, 'localhost-cert.pem')),
        allowHTTP1: true
    };
    const server = http2.createSecureServer(options);
    
        

    const wss = new WebSocketServer({noServer: true});

    server.on('upgrade', function upgrade(request, socket, head){
        if(request.url === '/yjs-router'){
            wss.handleUpgrade(request, socket, head, (ws)=>{
                wss.emit('connection', ws, request);
            })
        }else{
            socket.destroy();
        }


    });
    wss.on('connection', (ws)=> handleClientconnection(ws));
    server.listen(8443, '0.0.0.0', () => {
            console.log('WebSocket Router running on wss://0.0.0.0:8443/yjs-router')
        });
    }catch(error){
        console.error('Server Error: ', error.message);
    }

}
    function handleClientconnection(ws){
        let currentRoom = null;
        ws.on('message', (data)=>{
            const roomid = data.toString().trim();
            const dataStr = data.toString();
            const datajson = JSON.parse(data.toString());
            //initiating connection if a new user trying to join a room
            if(!currentRoom){
                const roomId = roomid;
                console.log(`user joined room: [${roomId}]`)
                if(!activeRooms.has(roomId)){
                    activeRooms.set(roomId, {doc: new Y.Doc(), clients: new Set()});
                }
                currentRoom = activeRooms.get(roomId);
                currentRoom.clients.add(ws);
                const stateVector = Y.encodeStateAsUpdate(currentRoom.doc);
                const syncmsg = JSON.stringify({type: 'doc', data: Array.from(stateVector)});
                ws.send(syncmsg);
                return;
            }
            //update the servers local doc
            if(datajson.type === 'doc'){
                Y.applyUpdate(currentRoom.doc, new Uint8Array(datajson.data));
            }
            //share the reliable doc updates and the datagrams from the sending user to the rest of the users in the room
            for(const clientWS of currentRoom.clients){
                if(clientWS !== ws && clientWS.readyState === 1){
                    clientWS.send(dataStr);
                }
            }
            console.log('recieved sync data in room:', roomid);
        });
        ws.on('close', ()=>{
            if(currentRoom){
                currentRoom.clients.delete(ws);
                console.log('peer Disconnected');
            }
        });
        ws.on('error', ()=>{
            if(currentRoom){
                currentRoom.clients.delete(ws);
            }
        });

    }

    startHTTP2Server();