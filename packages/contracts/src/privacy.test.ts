import {describe,expect,it} from 'vitest';
import {privacySettingsSchema,readPrivacySettings,updatePrivacySettingsSchema,updateDirectInboxSchema} from './privacy.js';
describe('privacy contracts',()=>{
  it('migrates unset settings with message screening enabled',()=>{expect(readPrivacySettings(null)).toMatchObject({filterMessageRequests:true,mediaOthers:'HIDE',spamFilter:'NON_FRIENDS'});});
  it('fails closed for malformed stored configuration',()=>{expect(readPrivacySettings({profileVisibility:'invalid'})).toMatchObject({profileVisibility:'FRIENDS_ONLY',allowServerDirectMessages:false,friendRequestsEveryone:false});});
  it('rejects duplicate overrides, unknown keys and empty updates',()=>{
    const override={serverId:'018f0d7a-91ab-7abc-8def-0123456789ae',allowDirectMessages:true,filterMessageRequests:true};
    expect(privacySettingsSchema.safeParse({serverOverrides:[override,override]}).success).toBe(false);
    expect(updatePrivacySettingsSchema.safeParse({bypass:true}).success).toBe(false);
    expect(updatePrivacySettingsSchema.safeParse({}).success).toBe(false);
    expect(updatePrivacySettingsSchema.parse({mediaOthers:'BLOCK'})).toEqual({mediaOthers:'BLOCK'});
    expect(updateDirectInboxSchema.safeParse({action:'ACCEPT',userId:'other'}).success).toBe(false);
  });
});
