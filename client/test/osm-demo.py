import sys
import os
thispath = os.path.dirname(os.path.abspath(__file__)) 
sys.path.append(thispath + '/../')
import boptest
import time

bop = boptest.Boptest(url='http://alfalfastack.net')
#bop = boptest.Boptest(url='http://localhost')

osm_files = []
for _ in range(450):
    osm_files.append(thispath + '/CBI_EndtoEndTest_20190618_version2.osm')

siteids = bop.submit_many(osm_files)
bop.start_many(siteids, external_clock = "true")

for i in range(300):
    responses = bop.advance(siteids)

    steps = [r['step'] for r in responses]
    uniq = set(steps)
    print('simulations are on step: %s' % uniq)
    print('total responses: %s' % len(steps))
    print('\n')
    #total_rtu_power = 0.0
    #for siteid in siteids:
    #    rtu_power = bop.outputs(siteid)[u'RTU_Power']
    #    total_rtu_power = total_rtu_power + rtu_power
    #print(total_rtu_power)
    time.sleep(3)

bop.stop_many(siteids)

