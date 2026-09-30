import assert from 'node:assert/strict';
import test from 'node:test';
import {createDshTurnCorrelation} from '../src/components/AIChatBot/model/dshTurnCorrelation.ts';
const accepted=(overrides={})=>({type:'accepted',conversationId:'conversation',clientMessageId:'new-client',requestId:'new-request',accepted:true,...overrides});
const event=(type,requestId='new-request',extra={})=>({eventType:type,data:{requestId,...extra}});

test('server user.message can bind before accepted acknowledgement arrives',()=>{
 const turn=createDshTurnCorrelation('new-client','conversation');
 assert.equal(turn.acceptsEvent(event('user.message','new-request',{clientMessageId:'new-client'})),false);
 assert.equal(turn.acceptsEvent(event('assistant.message')),true);
 assert.equal(turn.accept(accepted()),'accepted');
 assert.equal(turn.acceptsEvent(event('turn.completed')),true);
});
test('accepted acknowledgement can bind before streamed user.message',()=>{
 const turn=createDshTurnCorrelation('new-client','conversation');
 assert.equal(turn.accept(accepted()),'accepted');
 assert.equal(turn.acceptsEvent(event('assistant.chunk')),true);
 assert.equal(turn.acceptsEvent(event('user.message','new-request',{clientMessageId:'new-client'})),false);
 assert.equal(turn.acceptsEvent(event('runtime.error')),true);
});
for(const type of ['assistant.chunk','assistant.message','assistant.status','turn.completed','runtime.error'])test('old '+type+' cannot populate or finish a new request',()=>{
 const turn=createDshTurnCorrelation('new-client','conversation');
 assert.equal(turn.acceptsEvent(event(type,'old-request')),false);
 turn.accept(accepted());
 assert.equal(turn.acceptsEvent(event(type,'old-request')),false);
 assert.equal(turn.acceptsEvent({eventType:type,data:{}}),false);
 assert.equal(turn.acceptsEvent(event(type)),true);
});
test('the actual busy response never binds the rejected new message to an old running turn',()=>{
 const turn=createDshTurnCorrelation('new-client','conversation');
 assert.equal(turn.accept(accepted({accepted:false,duplicate:false,busy:true,code:'conversation_busy'})),'busy');
 assert.equal(turn.acceptsEvent(event('assistant.message','old-running')),false);
 assert.equal(turn.acceptsEvent(event('turn.completed','old-running')),false);
});
test('different client messages and conversations cannot bind or reject the current request',()=>{
 const turn=createDshTurnCorrelation('new-client','conversation');
 assert.equal(turn.accept(accepted({clientMessageId:'other'})),'ignore');
 assert.equal(turn.accept(accepted({conversationId:'other'})),'ignore');
 assert.equal(turn.accept(accepted({clientMessageId:'other',accepted:false,busy:true})),'ignore');
 turn.acceptsEvent(event('user.message','old-request',{clientMessageId:'other'}));
 assert.equal(turn.acceptsEvent(event('turn.completed','old-request')),false);
});
test('missing and conflicting server request identities are rejected instead of broadening correlation',()=>{
 const turn=createDshTurnCorrelation('new-client','conversation');
 assert.equal(turn.accept(accepted({requestId:''})),'invalid');
 assert.equal(turn.accept(accepted()),'accepted');
 assert.equal(turn.accept(accepted({requestId:'different'})),'invalid');
 turn.acceptsEvent(event('user.message','different',{clientMessageId:'new-client'}));
 assert.equal(turn.acceptsEvent(event('assistant.message','different')),false);
});
test('duplicate acknowledgement retains the original correlated request identity',()=>{
 const turn=createDshTurnCorrelation('new-client','conversation');
 assert.equal(turn.accept(accepted({accepted:false,duplicate:true})),'accepted');
 assert.equal(turn.acceptsEvent(event('assistant.message')),true);
});
