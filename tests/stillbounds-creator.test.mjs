import test from 'node:test';
import assert from 'node:assert/strict';
import {isCreatorAccount,billingConfig} from '../lib/stillbounds/billing-policy.ts';

test('creator access requires the configured immutable account ID and verified email',()=>{
 assert.equal(isCreatorAccount({id:'creator-id',emailVerified:true},'creator-id'),true);
 assert.equal(isCreatorAccount({id:'creator-id',emailVerified:false},'creator-id'),false);
 assert.equal(isCreatorAccount({id:'another-id',emailVerified:true},'creator-id'),false);
 assert.equal(isCreatorAccount({id:'',emailVerified:true},''),false);
});
test('creator entitlement is absent by default and reads server configuration only',()=>{
 assert.equal(billingConfig({}).creatorUserId,'');
 assert.equal(billingConfig({STILLBOUNDS_CREATOR_USER_ID:' creator-id '}).creatorUserId,'creator-id');
 assert.equal(billingConfig({NEXT_PUBLIC_STILLBOUNDS_CREATOR_USER_ID:'attacker'}).creatorUserId,'');
});
