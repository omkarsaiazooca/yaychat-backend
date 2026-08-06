# BTCY Sell Eligible Users Snapshot

Generated at: `2026-05-23T05:42:21.811Z`

Database: `prod-indexx-exchange`

This report lists users who currently have remaining BTCY sell allowance under the BTCY sell eligibility rule.

## Eligibility Rule

A user can sell BTCY when they have eligible BTCY from either a completed BTCY buy paid through one of the approved real payment paths or a completed in-app BTCY Alchemy session.

- USDT
- USDC
- PayPal
- Stripe
- completed BTCY Alchemy sessions that were not finalized as external Solana/Tron withdrawals

PayPal is checked in both places:

- completed BTCY buy orders with PayPal/Stripe-style payment type
- completed PayPal collection records linked to a completed BTCY buy order by `orderId`

The sellable amount is capped to eligible BTCY:

```text
remaining sellable BTCY = eligible BTCY buys + completed eligible Alchemy BTCY - later BTCY sells/converts that consume eligible BTCY
```

The allowance is calculated chronologically. BTCY sells/converts that happened before an eligible buy or Alchemy completion do not consume that later allowance.

Users who only received BTCY through mining, airdrop, manual wallet credit, external Alchemy withdrawal, or convert history are not eligible unless they also have an eligible completed BTCY buy or eligible completed Alchemy session.

## Eligible Users

| Email | Purchased BTCY | Alchemy BTCY | Total Eligible BTCY | Used BTCY | Can Sell BTCY | Reason |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| sunkuomkarsai12121@gmail.com | 91.493752623583 | 266787 | 266878.49375262356 | 0 | 266878.49375262356 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order; Completed BTCY Alchemy session |
| omkar@azooca.com | 0 | 24300 | 24300 | 0 | 24300 | Completed BTCY Alchemy session |
| jerryhngo@gmail.com | 13314.81506260431 | 0 | 13314.81506260431 | 0 | 13314.815062604312 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| sunkuomkarsai5@gmail.com | 0 | 4310 | 4310 | 1900 | 2410 | Completed BTCY Alchemy session |
| ms9820639@gmail.com | 1112.29969459 | 0 | 1112.29969459 | 0 | 1112.29969459 | Completed BTCY buy paid by USDT |
| ajayg2004@gmail.com | 0 | 1070 | 1070 | 0 | 1070 | Completed BTCY Alchemy session |
| uniqueweightlose@gmail.com | 0 | 1070 | 1070 | 0 | 1070 | Completed BTCY Alchemy session |
| sergejkirsch79@gmail.com | 999.802776185477 | 0 | 999.802776185477 | 0 | 999.802776185477 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| diassiba79@gmail.com | 0 | 920 | 920 | 0 | 920 | Completed BTCY Alchemy session |
| issaumer125@gmail.com | 0 | 860 | 860 | 0 | 860 | Completed BTCY Alchemy session |
| dbrandon928@gmail.com | 0 | 830 | 830 | 0 | 830 | Completed BTCY Alchemy session |
| nugraha.indra0221@gmail.com | 165.350224 | 750 | 915.350224 | 160 | 755.350224 | Completed BTCY buy paid by USDT; Completed BTCY Alchemy session |
| nafiouakondoh23@gmail.com | 0 | 750 | 750 | 0 | 750 | Completed BTCY Alchemy session |
| walidbourgeoistou@gmail.com | 0 | 750 | 750 | 0 | 750 | Completed BTCY Alchemy session |
| yaoviagbessik@gmail.com | 0 | 750 | 750 | 0 | 750 | Completed BTCY Alchemy session |
| yaumilsigli66@gmail.com | 0 | 750 | 750 | 0 | 750 | Completed BTCY Alchemy session |
| mr.zakimed@gmail.com | 478.4486031 | 0 | 478.4486031 | 0 | 478.4486031 | Completed BTCY buy paid by USDT |
| abbasafvasibi@gmail.com | 473.568934 | 0 | 473.568934 | 0 | 473.568934 | Completed BTCY buy paid by USDT |
| traylil503@gmail.com | 405.250465 | 0 | 405.250465 | 0 | 405.250465 | Completed BTCY buy paid by USDT |
| alexanderchirino@gmail.com | 314.318496208114 | 0 | 314.318496208114 | 0 | 314.318496208114 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| ammanullah60@gmail.com | 300.49 | 0 | 300.49 | 30 | 270.49 | Completed BTCY buy paid by USDT |
| lili@azooca.com | 255.01 | 0 | 255.01 | 0 | 255.01 | Completed BTCY buy paid by USDC; Completed BTCY buy paid by USDT |
| brsaraivar@gmail.com | 215.833180741617 | 0 | 215.833180741617 | 0 | 215.833180741617 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| hatchtage@yahoo.com | 794.551040441456 | 0 | 794.551040441456 | 601.99 | 192.561040441456 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order; Completed BTCY buy paid by USDC |
| ekopastikaya95@gmail.com | 174.475074961 | 860 | 1034.475074961 | 860 | 174.475074961 | Completed BTCY buy paid by USDT; Completed BTCY Alchemy session |
| ismiauliamaghfirah@gmail.com | 167.5473644 | 0 | 167.5473644 | 0 | 167.5473644 | Completed BTCY buy paid by USDT |
| yuyunm665@gmail.com | 167.1402304 | 0 | 167.1402304 | 0 | 167.1402304 | Completed BTCY buy paid by USDT |
| songthanh9999@gmail.com | 162.7481908 | 0 | 162.7481908 | 0 | 162.7481908 | Completed BTCY buy paid by USDT |
| muhammadmarjuki1203@gmail.com | 147.614549 | 0 | 147.614549 | 0 | 147.614549 | Completed BTCY buy paid by USDT |
| medygalagala388@gmail.com | 132.568595189156 | 0 | 132.568595189156 | 0 | 132.568595189156 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| cholidaja45@gmail.com | 123.502224643603 | 0 | 123.502224643603 | 0 | 123.502224643603 | Completed BTCY buy paid by USDT |
| ppatel5169@gmail.com | 114.190381629965 | 0 | 114.190381629965 | 0 | 114.190381629965 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| gerald_geraldgplj@yahoo.com | 111.214565371254 | 0 | 111.214565371254 | 0 | 111.214565371254 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| drone1215@gmail.com | 110.987803661243 | 0 | 110.987803661243 | 0 | 110.987803661243 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| taraboi103@gmail.com | 110.461962975359 | 0 | 110.461962975359 | 0 | 110.461962975359 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| rakeyteah0@gmail.com | 107.258588463325 | 0 | 107.258588463325 | 0 | 107.258588463325 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| dilqamshabanov@gmail.com | 93.467037307088 | 0 | 93.467037307088 | 0 | 93.467037307088 | completed PayPal payment linked to BTCY buy order |
| lashashervashidze@gmail.com | 92.706587359271 | 0 | 92.706587359271 | 0 | 92.706587359271 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| gafterjun@gmail.com | 35.962795558619 | 0 | 35.962795558619 | 0 | 35.962795558619 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| h4a5i@punkproof.com | 13.957474367098 | 0 | 13.957474367098 | 0 | 13.957474367098 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| sunkuomkarsai@gmail.com | 39.853834758357 | 5000 | 5039.853834758356 | 5026.973262139621 | 12.880572618736 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order; Completed BTCY Alchemy session |
| joritakahashi@gmail.com | 8.200080655993 | 0 | 8.200080655993 | 0 | 8.200080655993 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| agustinussinaga0@gmail.com | 0.702336894328 | 0 | 0.702336894328 | 0 | 0.702336894328 | Completed BTCY buy paid by PayPal; completed PayPal payment linked to BTCY buy order |
| mahuclo74@gmail.com | 1101.255191135046 | 0 | 1101.255191135046 | 1101 | 0.255191135046 | Completed BTCY buy paid by USDT |
| alexanderkruus@gmail.com | 127.13 | 0 | 127.13 | 127 | 0.13 | Completed BTCY buy paid by USDC |
| iyastopik63@gmail.com | 166.1 | 0 | 166.1 | 166 | 0.1 | Completed BTCY buy paid by USDT |
| singjayabandung@gmail.com | 1241.6 | 0 | 1241.6 | 1241.57 | 0.03 | Completed BTCY buy paid by USDT |
| usmanwunti2020@gmail.com | 334.3578394 | 1710 | 2044.3578394 | 2044.35 | 0.0078394 | Completed BTCY buy paid by USDT; Completed BTCY Alchemy session |
| billyoktria31@gmail.com | 468.37671171 | 0 | 468.37671171 | 468.3767117 | 1e-8 | Completed BTCY buy paid by USDT |
| meliawaty65@gmail.com | 1865.19380182 | 0 | 1865.19380182 | 1865.19380182 | 0 | Completed BTCY buy paid by USDT |

## Notes

- The `Alchemy BTCY` column includes completed in-app Alchemy sessions, excluding sessions finalized as external Solana/Tron withdrawals.
- The `Used BTCY` column is BTCY already consumed from eligible allowance. It comes from BTCY sell orders that are not cancelled/expired and completed BTCY convert orders where BTCY was the input, but only when those orders occurred after eligible buys or Alchemy completions with available allowance.
- This is a point-in-time snapshot. New completed BTCY buys and eligible completed Alchemy sessions increase the allowance.
- New BTCY sell orders or completed BTCY converts reduce allowance only after there is eligible BTCY available to consume.
- Very small remaining values are kept exactly as returned by the database calculation.

## Used BTCY Sources

Only users with non-zero `Used BTCY` are listed here.

| Email | Used BTCY | Where It Was Used | Order ID | Status | Date |
| --- | ---: | --- | --- | --- | --- |
| alexanderkruus@gmail.com | 127 | Completed BTCY convert from BTCY to USDT | 30519820 | Completed | 2026-03-30T03:34:44.366Z |
| alwinwise4@gmail.com | 830 | Completed BTCY convert from BTCY to USDT | 50696507 | Completed | 2025-12-17T17:17:52.581Z |
| ammanullah60@gmail.com | 10 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778252493557 | Pending | 2026-05-08T15:01:33.557Z |
| ammanullah60@gmail.com | 10 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778606823149 | Pending | 2026-05-12T17:27:03.149Z |
| ammanullah60@gmail.com | 10 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778691677762 | Pending | 2026-05-13T17:01:17.763Z |
| arslandev180@gmail.com | 1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | 1777906289742 | Completed | 2026-05-04T14:58:15.287Z |
| arslandev180@gmail.com | 1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1777908908766 | Completed | 2026-05-04T15:35:34.336Z |
| arslandev180@gmail.com | 1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1777911285084 | Completed | 2026-05-04T16:17:21.256Z |
| arslandev180@gmail.com | 1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1777917818196 | Completed | 2026-05-05T12:12:23.845Z |
| arslandev180@gmail.com | 0.2 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1777983320382 | Completed | 2026-05-05T12:16:04.263Z |
| arslandev180@gmail.com | 1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1777983514482 | Completed | 2026-05-05T12:18:55.392Z |
| arslandev180@gmail.com | 0.1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1777990497122 | Pending | 2026-05-05T14:14:57.123Z |
| arslandev180@gmail.com | 0.1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1777992411645 | Pending | 2026-05-05T14:46:51.645Z |
| arslandev180@gmail.com | 0.1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1777992710725 | Pending | 2026-05-05T14:51:50.725Z |
| arslandev180@gmail.com | 0.1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1777993172222 | Pending | 2026-05-05T14:59:32.222Z |
| arslandev180@gmail.com | 1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778001243149 | Pending | 2026-05-05T17:14:03.149Z |
| arslandev180@gmail.com | 1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778001269502 | Pending | 2026-05-05T17:14:29.502Z |
| arslandev180@gmail.com | 1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778001527658 | Pending | 2026-05-05T17:18:47.658Z |
| arslandev180@gmail.com | 1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778002546043 | Pending | 2026-05-05T17:35:46.043Z |
| arslandev180@gmail.com | 1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778002679755 | Pending | 2026-05-05T17:37:59.755Z |
| arslandev180@gmail.com | 1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778002737818 | Pending | 2026-05-05T17:38:57.818Z |
| arslandev180@gmail.com | 10 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778003358665 | Pending | 2026-05-05T17:49:18.665Z |
| arslandev180@gmail.com | 10 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778003539377 | Pending | 2026-05-05T17:52:19.377Z |
| arslandev180@gmail.com | 10.82 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778004130108 | Pending | 2026-05-05T18:02:10.108Z |
| billyoktria31@gmail.com | 130.47 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778884014836 | Completed | 2026-05-21T19:13:33.908Z |
| billyoktria31@gmail.com | 337.9067117 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1779019344934 | Completed | 2026-05-21T19:14:57.115Z |
| bitcoinlightening2929@gmail.com | 87.333979197221 | Completed BTCY convert from BTCY to USDT | 40942357 | Completed | 2026-02-20T02:25:28.213Z |
| chunk.socket_1g@icloud.com | 1548.5525884 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778871103576 | Completed | 2026-05-21T19:04:28.960Z |
| ekopastikaya95@gmail.com | 860 | Completed BTCY convert from BTCY to USDT | 32515660 | Completed | 2025-12-18T14:31:00.591Z |
| gbevougatto@gmail.com | 720 | Completed BTCY convert from BTCY to USDT | 99820823 | Completed | 2025-12-20T08:14:50.980Z |
| gulraiz726@gmail.com | 750 | Completed BTCY convert from BTCY to USDT | 38572748 | Completed | 2025-12-17T18:21:07.757Z |
| hatchtage@yahoo.com | 601.99 | Completed BTCY convert from BTCY to USDT | 72181825 | Completed | 2026-02-10T05:21:24.326Z |
| iyastopik63@gmail.com | 166 | Completed BTCY convert from BTCY to USDT | 26533346 | Completed | 2026-04-26T09:06:39.286Z |
| jatipersadamandiri77@gmail.com | 166.9 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778871040953 | Completed | 2026-05-21T19:05:49.650Z |
| kuswantokus884@gmail.com | 1080 | Completed BTCY convert from BTCY to USDT | 88398452 | Completed | 2026-01-23T14:47:48.849Z |
| mahuclo74@gmail.com | 1101 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1779275340230 | Pending | 2026-05-20T11:09:00.230Z |
| meliawaty65@gmail.com | 1000 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1779027575524 | Pending | 2026-05-17T14:19:35.525Z |
| meliawaty65@gmail.com | 300 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1779060732041 | Pending | 2026-05-17T23:32:12.041Z |
| meliawaty65@gmail.com | 200 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1779060871540 | Completed | 2026-05-22T20:44:10.363Z |
| meliawaty65@gmail.com | 140 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1779061147088 | Completed | 2026-05-22T20:44:33.839Z |
| meliawaty65@gmail.com | 225.19380182 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1779407034118 | Pending | 2026-05-21T23:43:54.118Z |
| muhdbalaweenty712@gmail.com | 1120 | Completed BTCY convert from BTCY to USDT | 52705645 | Completed | 2025-12-18T10:18:36.007Z |
| muhdbalaweenty712@gmail.com | 780 | Completed BTCY convert from BTCY to USDT | 52761079 | Completed | 2026-01-21T13:19:03.691Z |
| nugraha.indra0221@gmail.com | 160 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1779276811463 | Completed | 2026-05-21T19:19:12.569Z |
| rongkomodo1990@gmail.com | 830 | Completed BTCY convert from BTCY to USDT | 82467066 | Completed | 2025-12-18T21:53:14.488Z |
| sangmey14@gmail.com | 130.49 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778883221480 | Completed | 2026-05-21T19:07:57.810Z |
| sangmey14@gmail.com | 977.49516778 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1779019199572 | Pending | 2026-05-17T11:59:59.572Z |
| simonazzahraeva1@gmail.com | 1080 | Completed BTCY convert from BTCY to USDT | 12105285 | Completed | 2025-12-17T17:13:41.015Z |
| singjayabandung@gmail.com | 130.47 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778883675407 | Completed | 2026-05-21T19:08:41.831Z |
| singjayabandung@gmail.com | 1111.1 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1779019199788 | Pending | 2026-05-17T11:59:59.789Z |
| sugihbanda117@gmail.com | 166.9 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1778882746647 | Completed | 2026-05-21T19:06:36.907Z |
| sujektogayam@gmail.com | 1070 | Completed BTCY convert from BTCY to USDT | 83381856 | Completed | 2025-12-18T16:40:30.336Z |
| sultanthankyou92@gmail.com | 249.379668075662 | Completed BTCY convert from BTCY to USDT | 74294714 | Completed | 2026-05-08T15:15:03.013Z |
| sunkuomkarsai@gmail.com | 946.973262139621 | Completed BTCY convert from BTCY to USDT | 18609183 | Completed | 2025-12-16T16:29:38.447Z |
| sunkuomkarsai@gmail.com | 1000 | Completed BTCY convert from BTCY to USDT | 22990211 | Completed | 2025-12-16T14:25:04.177Z |
| sunkuomkarsai@gmail.com | 1000 | Completed BTCY convert from BTCY to USDT | 24427445 | Completed | 2025-12-16T14:19:17.500Z |
| sunkuomkarsai@gmail.com | 1000 | Completed BTCY convert from BTCY to IUSD+ | 25545289 | Completed | 2025-12-16T15:24:04.415Z |
| sunkuomkarsai@gmail.com | 80 | Completed BTCY convert from BTCY to USDT | 44751789 | Completed | 2025-12-16T15:35:12.841Z |
| sunkuomkarsai@gmail.com | 1000 | Completed BTCY convert from BTCY to IUSD+ | 80083460 | Completed | 2025-12-16T14:17:07.680Z |
| sunkuomkarsai5@gmail.com | 100 | Completed BTCY convert from BTCY to USDT | 39585035 | Completed | 2025-12-16T16:02:49.288Z |
| sunkuomkarsai5@gmail.com | 500 | Completed BTCY convert from BTCY to IUSD+ | 57925231 | Completed | 2025-12-16T16:03:16.531Z |
| sunkuomkarsai5@gmail.com | 800 | Completed BTCY convert from BTCY to USDT | 85773315 | Completed | 2025-12-16T16:22:25.324Z |
| sunkuomkarsai5@gmail.com | 500 | Completed BTCY convert from BTCY to USDT | 98346029 | Completed | 2025-12-16T15:48:00.398Z |
| usmanwunti2020@gmail.com | 910 | Completed BTCY convert from BTCY to USDT | 76955452 | Completed | 2026-01-21T12:51:19.516Z |
| usmanwunti2020@gmail.com | 800 | Completed BTCY convert from BTCY to USDT | 94642124 | Completed | 2025-12-18T14:39:02.464Z |
| usmanwunti2020@gmail.com | 334.35 | BTCY sell order reserved against allowance, because it is not cancelled or expired | CRYPTO_SELL1779253271045 | Completed | 2026-05-21T19:18:49.452Z |
