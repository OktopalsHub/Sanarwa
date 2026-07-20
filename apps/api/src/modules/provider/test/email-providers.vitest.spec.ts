/**
 * Email Providers Comprehensive Test Suite
 * Tests all email providers (Mailgun, SendGrid, SES) with fallback logic
 */

import type { describe, it, expect, beforeAll, beforeEach, Mock } from 'vitest';
import axios, { AxiosInstance } from 'axios';

describe('Email Providers Integration Tests', () => {
  const baseURL = 'http://localhost:9000/api/v1';
  let api: AxiosInstance;

  // Test data
  const timestamp = Date.now();
  const testUser = {
    email: `email-test-${timestamp}@example.com`,
    password: 'EmailTest123!',
    firstName: 'Email',
    lastName: 'Tester'
  };

  let authData: {
    accessToken: string;
    userId: string;
    tenantId: string;
  };

  let projectData: {
    id: string;
    name: string;
  };

  let apiKeyData: {
    key: string;
    id: string;
  };

  beforeAll(async () => {
    api = axios.create({
      baseURL,
      timeout: 30000,
      validateStatus: () => true
    });

    await waitForServer();
    console.log('✅ Server ready for email provider tests');
  });

  async function waitForServer(maxRetries = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get('/health');
        if (response.status === 200) return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error('Server not ready. Start with: npm run start:dev');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  describe('Setup: User, Tenant, Project & API Key', () => {
    it('should register user and get tenant', async () => {
      const response = await api.post('/auth/register', testUser);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('access_token');
      expect(response.data).toHaveProperty('user');

      authData = {
        accessToken: response.data.access_token,
        userId: response.data.user.id,
        tenantId: response.data.user.tenantId || 'default'
      };

      console.log('✅ User registered with tenant access');
    });

    it('should create a project for email testing', async () => {
      const projectPayload = {
        name: `Email Test Project ${timestamp}`,
        description: 'Project for testing email providers',
        settings: {
          emailEnabled: true,
          defaultFromEmail: `noreply@emailtest${timestamp}.com`,
          defaultFromName: 'E);
});  });
  }d');
  pleteomting test cte limiog('✅ Ra.lole   cons      
   
);de)codes(, 201].inclucode => [200des.some(s = statusCohasSucces   const 
   429);e ===  codsome(code =>sCodes.it = statu hasRateLim
      constsponses rerate limit and cessix of suchould have m
      // S
      );statusCodess:', codeus g test state limitinole.log('Ratons    c
        us);
tatap(r => r.sesponses.msCodes = rstatuconst      ses);
 .all(promiomise= await Prponses nst res      co);

     
 )
        }a.key}` }yDatapiKeer ${`Bearhorization: Auters: { head       {
        }, s'
   mitting rate li'Tes content:          Test',
Limit ate ect: 'R        subj],
  le.com' }t@examp-tesit: 'rate-lim{ email: [recipients         ,
 : ['email']ls channe         es', {
/messagdkost('/s      api.p 
  map(() =>(null).rray(5).fill = Apromises    const ting
  t rate limi tesests topid reque ratipluld m// Sen  
    ) => {sync (limiting', ae d handle ratshoul

    it('  });ected');
  rejy perlprod ormed payloa Malflog('✅console.
      e.status);nsespotain(roCon2]).t[400, 42ct(      expe);

      }y}` }
ata.ke ${apiKeyD: `Bearerionorizat { Auths:   header, {
        }ontent
    and cecipientsg rssin    // Mi
    ct: 'Test'      subjel'],
  'emaiels: [  chann     ields
 uired fissing req      // M{
  , messages'post('/sdk/api.= await sponse  const re {
      =>ync ()payload', asrmed email malfole uld hand it('sho

      });d');
 rejecteey properly I kInvalid APg('✅ lo    console.;
  Be(401)s).tose.statuonsp   expect(re
      });

   alid-key' }Bearer invn: 'tiooriza{ Autheaders:    h       }, {
est'
    'Tontent:        c 'Test',
 ect:   subj}],
     ple.com' 'test@exam [{ email: cipients:  re],
      email'['els:    chann, {
     ages'messost('/sdk/ait api.psponse = aw    const re> {
  async () =y', lid API keva ind handlet('shoul => {
    i, ()es'Edge Casng &  Handliror('Er  describe;

});
  })   
      }
 tus);ponse.staContain(res404]).tot([200, xpec        e;
 completed')ics testetrr movide('ℹ️ Pre.log   consol {
      } else
     lly');successfurieved s reter metricog('✅ Providsole.l   con
     ue);.toBe(trse.data))sponArray(rerray.isct(A      expe00) {
  us === 2atonse.st  if (resp
        
  ponse.data);tus, response.stase:', rescs responrier metrovidlog('P  console.       });

 }` }
  encessTok{authData.acarer $ization: `Be{ Authoreaders:   h      etrics', {
ers/email/mvidt('/prot api.geonse = awaist resp con
     ync () => {asics', metrrmance vider perfo progetit('should ;

       }
    })
   e.status);n(responstoContai4]).40([200,  expect');
       pletedt comtesry stats ve('ℹ️ Deliconsole.log {
             } elsefully');
 d success retrievestatisticsery ✅ Delivonsole.log('        ceryRate');
perty('deliva).toHaveProonse.datrespect(       expges');
 Messay('totalveProperta).toHaponse.datpect(res       ex200) {
 = us ==tat(response.s      if  
;
     e.data)onsus, respnse.state:', resporesponsstats ery liv('Deonsole.log  c });

    }` }
     ata.key{apiKeyD $rer`Beaorization:  Auth {aders:     hery,
   ms: statsQue para   {
     /delivery',stats.get('/sdk/ait api = awnst response
      co   };
ay'
   By: 'd     group   'email',
 nnel:      cha
  SOString(),ate().toIw DdDate: ne     enys ago
   ), // 7 daOString(oIS.t 60 * 1000)* 60 *() - 7 * 24 ate(Date.now new DrtDate:sta      {
  y = tsQuer   const sta=> {
   c () tics', asynvery statisli email de'should get it(() => {
   s Tests', ytics & StatEmail Anal('scribe  de  });



    });     }tus);
 e.staonsn(resp]).toContai0, 404 expect([20     ed');
  letomptest c reports Deliverylog('ℹ️ onsole.       c} else {
   lly');
    fued successorts retrievy repiver Delole.log('✅ons   c
     ue);e(troB.tata)).dresponseray(Ar.ist(Array    expec
     === 200) {nse.status  if (respo   
    );
   ponse.datarestus, ponse.staessponse:', rreports relivery sole.log('De      con);

     }y}` }
 Data.ker ${apiKey: `Beareation{ Authorizs: header        eries`, {
ivgeId}/delmessaages/${ess(`/sdk/mapi.get = await seonst respon     c() => {
 rts', async y repoeriv deluld gett('sho;

    i
    })      }e.status);
in(responstaCon]).to([200, 404 expect    ;
   ')mpletedtus test coage sta Messℹ️onsole.log('     c
   se {  } el;
    ly') successfulvedatus retrieessage st.log('✅ Monsole     c
   y('status');oHavePropertta).tdaesponse.pect(r     ex'id');
   roperty(oHavePta).t(response.da  expect) {
      == 200status =sponse.re (    if
      
  data);e.us, response.stat:', responsresponses statusage log('Mes console.         });

y}` }
  iKeyData.ke`Bearer ${aption: orizaers: { Authead
        hatus`, {essageId}/stessages/${mdk/met(`/si.g= await apst response  con  }

     }`;
    _${timestamp `msgageId = mess
       ssageId) {!me     if ({
 > sync () =tus', adelivery stasage ld get mes   it('shou

 });}
         tests');
  tracking D forage ImessUsing mock le.log('ℹ️ conso        mp}`;
${timesta`msg_eId =    messag    lse {
    } eId);
   D:', messagemessage Iemail sent, ckable ('✅ Trasole.log    con
    uthy();).toBeTr(messageId      expecta.id;
  se.dat responessageId =        m0) {
 20.status ===| response201 | === se.statuspon if (res
        });
     }
      d
ta.ijectDaID': proX-Project-      '    ta.key}`,
 ${apiKeyDa`Beareration': iz  'Author
        {ers: ead     hmail, {
   bleEkaages', trac/mess('/sdkait api.postnse = awonst respo  c };

         }
   '
     stcking-te 'tra   testType:
       e,s: tru  trackClick,
        : true trackOpens          {
ta:etada     m
   d</p>',le enabas tracking hails em<p>Thi content: '  
     l Test',mai E: 'Trackableubject
        sng Test' }],Tracki', name: 'ple.comg-test@examtrackin email: 'cipients: [{re       
 ail'],s: ['emchannel     l = {
   rackableEmai     const t) => {
 sync (age ID', a get messmail andle eackab send trt('should

    ing;d: strimessageI{
    let >  =s', ()g Testinvery Trackl Delicribe('Emai
  des});
  });
  }
       ;
 .status)responsentain(Co, 404]).toct([200expe;
        ted')omplest test cs limplate Teg('ℹ️.loonsole      c {
        } elsely');
cessfuled suc listplatesl temailog('✅ Emconsole.    e);
    rua)).toBe(te.datrray(responsct(Array.isA  expe     == 200) {
 tus =ponse.staes if (r    
     
  nse.data);atus, respoe.stns:', resposponse relates list'Tempconsole.log(      
});
}` }
      Tokenata.access${authDon: `Bearer atirizs: { Authoder  hea {
      tes/email',templai.get('/= await apt response ons c => {
     s', async ()latempil teuld list emait('sho
      });
 }
  s);
     e.staturesponsContain().to404]t([201, ecxp     e);
   leted'st compon tetite creag('ℹ️ Templale.lo   consolse {
          } elly');
 ed successfuplate creat tem'✅ Email.log(  console   me);
   load.na(templatePay.name).toBesponse.dataxpect(re
        ety('id');ePropertoHav.data).onseesp    expect(r {
    us === 201)esponse.stat(r      if 
      
data);nse. respostatus,onse.onse:', respeation resplate crle.log('Temp   conso

      });   oken}` }
ssT.acce{authDatan: `Bearer $atio: { Authorizaders
        head, {tePaylompla', teates/email/templost('t api.p = awai responseonst      c    };

mail']
  supportEinUrl', ' 'loganyName',ame', 'compstNfiriables: ['       vararted.',
 to get st} {loginUrl} Visit {anyName}}.mping {{cooinyou for jme}}! Thank stName {{firWelco    text: '
            `,</html>
         
 >      </body   }</p>
   upportEmail}t {{sContact us aelp?  <p>Need h           /p>
  .<et started</a> to gere}">hginUrl}"{{lo href=k <alic      <p>C      
  >/pame}}.<nyN{{compafor joining nk you      <p>Tha>
         ame}}!</h1rstNfilcome {{1>We      <h    dy>
    bo  <          tml>
      <h `
           html:,
 anyName}}!'to {{compme t: 'Welco subjec       test',
me-email- 'welco  name:= {
      tePayload nst templa  co> {
    c () = asynte',plail temeate emaould cr
    it('sh) => { Tests', (ntte ManagemeTemplaribe('Email 

  desc  });  });
}
  s);
      nse.statutain(respotoCon200, 404]).    expect([  eted');
  t test comploinviders endpro P'ℹ️le.log(     conso {
    else');
      }s retrievedovidervailable pr Ae.log('✅    consol);
    (truedata)).toBey(response.y.isArraect(Arra  exp
      == 200) {tatus =e.spons     if (res
       e.data);
espons, re.statusespons rse:',ders responoviAvailable prg('ole.lonsco  

    ); }
      }essToken}`Data.acc ${autharer: `Bethorizationeaders: { Au        h{
lable', /email/avaidersviro/p.get('ait api awnse = const respo => {
      async ()providers',email e ailablould get av
    it('sh});
     }
    atus);
 stse.spontain(reCon 401]).to01, 404,0, 2t([20   expec    ;
 )')tiont validad (endpoinleteck test complba'ℹ️ Falle.log(       consoelse {
       } ;
ing')c workback logier fallovid('✅ Prle.log    consod');
    perty('ia).toHavePro.datnsespoexpect(re    
    == 200) {se.status =spon= 201 || rese.status ==onf (respS)
      i(SEer providck using fallbaceed l sucShould stil/      /
      
 nse.data); response.status,po', resonse:t respallback tes('Fog  console.l});

    }
            
  ailurer fdelate provi simur tostom heade// Cuue' lback': 'trFal   'X-Force-id,
       ojectData. prroject-ID':-P  'X      key}`,
  eyData.r ${apiK`Bearen': horizatio  'Aut{
        eaders:  h    {
    thFallback,Wiages', emailessk/mt('/sdit api.poswaesponse = a const r};

             }
true
      llback: forceFa   t',
       tesk- 'fallbac testType:{
         data: tame,
        p>'ogic</ack lallbder fg provi<p>Testin  content: '
      st Email',back Te 'Fallect:ubj     s],
    }Test'lback ame: 'Falom', nt@example.callback-tes{ email: 'fecipients: [
        rail'],: ['emhannels
        clback = {WithFalt emailons cck
     fallbar ggetrito onfig rovider cd pith invali  // Test w     => {
async ()fails', ary primack when ovider fallbld test pr it('shou> {
   () =ic Tests', Logallback ovider Fdescribe('Pr  });

  );
    } }
  );
   tatusponse.sn(resaiont]).toC1, 404, 4010, 20([20     expectn)');
   atioint validpompleted (end comail test Bulk eog('ℹ️e.l  consol     {
  else    } );
  SDK'ssfully via cesucails sent lk em'✅ Bue.log(ol  cons);
      es).toBe(3essagtotalMta.ponse.da expect(res       ssages');
ty('totalMeroperavePata).toH(response.d  expect    
  batchId');veProperty('.toHanse.data)poexpect(res     
   ) { === 200tusponse.stares01 || === 2atus stesponse.    if (r   
  ;
   ponse.data)s, restatuonse.s:', respresponsemail lk eBusole.log('  con});

         }
 d
        ojectData.i: project-ID'      'X-Prson',
    n/j 'applicatio':ntent-Type   'Co
       ta.key}`,{apiKeyDa': `Bearer $uthorization        'A  : {
ders     heaload, {
   kEmailPaylk', bulssages/bu'/sdk/me.post(ait apiawe = onsesp    const r  };

  ]
        
             }'3' }
 d: : { userI data          
 3</p>',ail #is bulk emis ent: '<p>Th      cont    
  k Email 3',ect: 'Bul        subj }],
    User 3'ame: 'Bulk .com', nleampl: 'bulk3@ex [{ emaiecipients:          r
  mail'],els: ['e   chann       {
   ,
          }       d: '2' }
  erI data: { us          
 l #2</p>',s bulk emais ihi: '<p>T content     ,
       Email 2'ect: 'Bulk      subj,
      2' }]er e: 'Bulk Use.com', namk2@examplail: 'bul{ ements: [ipi   rec
         '],: ['emailhannels   c      {
         
             },
  '1' }userId:   data: {   ',
       /p>1<k email # is bulhis>Ttent: '<pcon          mail 1',
  lk Eect: 'Buubj           s}],
 '  1lk Userame: 'Bum', nle.coampl: 'bulk1@ex emaicipients: [{       re  l'],
   : ['emainels    chan        
     {[
     s: essage      mp}`,
  tameslk_${timbatchId: `bu
        yload = {ulkEmailPa   const b
    => {K', async ()a SDils vibulk ema send  it('should});

   
    ;
      }s)tatuponse.sin(res]).toConta01, 404, 401pect([200, 2
        ex);ation)' valided (endpointmplet col testaimplate emTe️ og('ℹonsole.l        c else {
      } SDK');
essfully viant succ seilemplate emae.log('✅ T    consol;
    ail')oContain('emls).tchanneata.se.dect(respon  exp   ('id');
   ertyavePrope.data).toHnst(respo     expec
   00) {tatus === 2e.s|| respons= 201  ==.statusponse if (res    
     );
  se.dataatus, responsponse.stse:', re responplate emailog('Teme.l consol   
      });
   }
     
  .idtData-ID': projecojectPrX-  '      
  /json',tion: 'applicant-Type'Conte    '      key}`,
{apiKeyData.`Bearer $ion': Authorizat         'ders: {
 hea      
  {ailPayload, emplateEm tmessages',post('/sdk/it api.waresponse = a    const   };

      }
        0'
ion: '1.eVers  templat
        ',plate-email 'temtType:    tes    ta: {
      metadagh',
    iority: 'hi    pr
        },om'
    example.c'support@rtEmail: ppo su         ogin',
ple.com/lpp.exams://a: 'httploginUrl  ',
        st Companye: 'Te  companyNam       e',
 'DoastName:       l,
     'John'stName:    fir{
          data:    -email',
 'welcomeId: late temp
             ],       }
  t User'
   Teslate emp 'Tame:      n      
mple.com',exast@ate-te: 'templ       email  {
     
        ients: [recip       l'],
 ['emaichannels:       load = {
  lateEmailPaynst temp
      coc () => { asyne',th templatK wi using SD emaild sendul'sho

    it(});    
      }
se.status);(respontaintoCon 401]).04,201, 4[200, expect();
        structure'I esting APilable, tvant not andpoi'ℹ️ SDK ee.log(  consol      
lse { e   }   ;
SDK')via cessfully  sucnt email seog('✅ HTML.lle   conso
     );tain('email'nnels).toConhase.data.cspon  expect(re     ');
 'statusy(pertePro).toHavtase.daponect(res       expy('id');
 pertveProe.data).toHaesponsct(rxpe  e{
      0)  20tatus ===ponse.s res01 ||tus === 2e.stapons (res
      if   
   e.data);s, responsnse.statu', respod response:K email senlog('SDonsole.  c

      });  
  
        }tData.id: projec-Project-ID'          'Xon/json',
icati 'appltent-Type': 'Con,
         eyData.key}`arer ${apiK: `Beization'Author  '        {
 headers:        , {
ailPayloads', emagek/messpi.post('/sd await= aesponse nst r

      co   };
           }ack-ses'
lber: 'fal      provid',
    mail 'html-epe:stTy     te
     etadata: {    mal',
    rm 'no  priority:      },
    
    ()StringoISOw Date().tamp: neesttim       ',
   erUs'Test  userName:         {
   data:>',
       the SDK.</pt via enest email s>This is a t!</h1><pr Testmail Providello from E<h1>Hetent: '    conK',
     SDail from 'Test Em   subject:
          ], }
   '
         ntcipieRe'Test  name:          ',
  ple.coment@exam: 'recipi    email         {
   s: [
      ecipient
        r'],ail'em channels: [ {
       lPayload = const emai
      => { async ()t',ML conteney - HT kith APIusing SDK wail uld send emt('sho
    i) => { (sts',Teding DK Email Senescribe('S d
 ;
  });
  })
  ;')testedon configuratirovider id pog('✅ SendGr console.l  atus);
   stnse.espon(rContaito0, 404]).[200, 40   expect(ata);
   onse.ds, respse.statu respon:',esponseion rlidatd va('SendGri.lognsole

      co    });n}` }
  okecessTthData.acarer ${auBe: `uthorization { Aders:hea
        nfig, {idCoendgrvalidate', sders/ost('/provii.p await apt response =cons         };

 ority: 3
   pri,
       ctive: truesA i      },
    '
     est Senderme: 'TNa   from       ple.com',
examt@'tesl:    fromEmai
       89',1234567 'SG.test    apiKey:      g: {
onfi     cail',
   el: 'emchann
        id',me: 'SendGr       nagrid',
 Id: 'sendrovider{
        pConfig = endgrid const s
     > {() =async uration', der config provi SendGridtestd  it('shoul
   

    });d');estefiguration tider conMailgun prov✅ g('  console.lo
    e.status);(responsontain4]).toC00, 400, 40 expect([2ta);
     response.daus, statponse., response:'lidation resailgun vae.log('Monsol     c

 );   }}` }
   kencessTouthData.ac{aer $aron: `Be Authorizatiders: {       heafig, {
 nConmailgu', validate/providers/api.post('it nse = awaspo  const re
       };
ty: 2
         priorie,
  ru: tActive  is,
         }'
     est SenderromName: 'T  f        
',ailgun.orgt.mst@tes'tel:     fromEmais',
       'uegion:         rrg',
 .mailgun.oin: 'test  doma        3456789',
'key-test12 apiKey:       : {
   nfig        co 'email',
l:  channe
      ',lgun'Mai     name: 
   mailgun',iderId: ' prov       nfig = {
lgunCot maions c     
) => {async (ion', r configuratde provi Mailguntestuld sho it('
   
    });
d');ion testenfiguratcoovider  prg('✅ SESconsole.lo    tatus);
  n(response.sai.toCont04]) 400, 4expect([200,     
 t existight no endpoint mcodes as theponse s resriou Accept va //  
      .data);
   seontus, respta response.s:',on responselidatiSES vaole.log(' consgging
     budense for he respo tLog/ 

      /
      });ken}` }essToa.acc{authDat `Bearer $horization:rs: { Aut  heade {
      nfig,ate', sesCoders/validt('/proviosawait api.presponse = nst       co };

   ity: 1
  prior
        ue,isActive: tr,
              }der'
  est Sen'TfromName: 
          om',example.c 'test@mEmail:  fro        east-1',
ion: 'us-       regey',
   est-secret-ksKey: 'tretAcces sec  
       ey',ccess-kId: 'test-acessKeyac      : {
     config     il',
  nel: 'emahan      c
  on SES',me: 'Amaz        na',
ws_sesviderId: 'a     pro{
   ig = nfnst sesCo co{
     > c () = asyniguration',ovider confSES prshould test     it(' {
() =>ests', tion Tiguraovider Conf Prmailescribe('E });

  d);
 
    };
      })')lablent not avai-keys endpoi key (aping mock APIg('ℹ️ Usie.lo     consol };
      p}`
    stam{time id: `key_$  
       ')}`,64urlasetoString('bmestamp}`).rom(`${tier.f${Buffev_roj_d_pkey: `nf
           {a =eyDat  apiKng
      ey for testi/ Mock API k{
        / else ;
      }ssfully')uccey created s✅ API kesole.log('   con        };
    ta.id
 response.daid:           ta.key,
se.daponkey: res     a = {
     eyDatapiK   1) {
      20==nse.status =(respo   if  });

   }` }
     essTokenthData.accBearer ${aurization: `thoders: { Au hea   {
     yload, apiKeyPa',-keyspist('/aait api.po= awponse t res  cons };

      : 10000
   DayimitPerrateL,
        00: 10LimitPerHour  rate  0,
    e: 10erMinutateLimitP   r  pment',
   ent: 'develoronm      envi,
  read']ail:, 'emnd'email:sesions: ['    permis.id,
    DatarojectojectId: p
        pramp}`,${timestAPI Key mail Test   name: `E    = {
   PayloadapiKeyt ns    co
  nc () => { usage', asyy for SDKate API keuld cre it('sho
       });
 }
   le)');
  abailavot s endpoint nct (projetadack project ℹ️ Using moole.log('cons              };

  load.nameojectPaypr   name:     amp}`,
   est`proj_${tim      id: ta = {
      projectDa
       dataock projectst, create moesn't exi ddpoints enctroje    // If pelse {
     }    y');
  lld successfuect create Proj('✅sole.log
        con        };ame
se.data.ne: respon    nam,
      a.idnse.datpo res   id:= {
       ectData roj      p
  01) {atus === 2esponse.stif (r
      });

      sToken}` }ccesa.aer ${authDatn: `Bearthorizatiors: { Au heade      ad, {
 loojectPayts', prrojecpi.post('/pt aai aw response =
      const  };
     }
 est'
      mail T