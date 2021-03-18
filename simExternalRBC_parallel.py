# -*- coding: utf-8 -*-
"""
This module manages the simulation of SOM3 in BOPTEST. It initializes,
steps and computes controls for the HVAC system.
The testcase docker container must be running before launching this
script.
"""

# GENERAL PACKAGE IMPORT
# ----------------------
import requests
import numpy as np
import json, collections
import matplotlib as mpl
from matplotlib import pyplot as plt
import matplotlib.animation as animation
import csv
import time as _time
import datetime
import os
from alfalfa_client import AlfalfaClient, Historian

plotVals = []

def run(plot=True, customized_kpi_config=None):
    '''Run test case.

    Parameters
    ----------
    plot : bool, optional
        True to plot timeseries results.
        Default is False.
    customized_kpi_config : string, optional
        The path of the json file which contains the customized kpi information.
        Default is None.

    Returns
    -------
    kpi : dict
        Dictionary of core KPI names and values.
        {kpi_name : value}
    res : dict
        Dictionary of trajectories of inputs and outputs.
    customizedkpis_result: dict
        Dictionary of tracked custom KPI calculations.
        Empty if no customized KPI calculations defined.

    '''

    global plotVals, fig, ax1, ax2
    
    
    # Setup live plot
    

    # Font, font size, and axes width 

    mpl.rcParams['font.family'] = 'Avenir'
    plt.rcParams['font.size'] = 18
    plt.rcParams['axes.linewidth'] = 2
    
    fig = plt.figure(figsize=(15, 8),) # size 3 inches by 3 inches
    ax1 = fig.add_axes([0.05, 0.05, 0.8, 0.35]) # multiple axes, parameter: [X-pos, Y-pos, width(%), height(%)], position of the bottom left corner
    ax2 = fig.add_axes([0.05, 0.6, 0.8, 0.35])
    
    ax1.spines['right'].set_visible(False)
    ax1.spines['top'].set_visible(False)
    
    ax1.xaxis.set_tick_params(which='major', size=10, width=2, direction='in', top='off')
    ax1.xaxis.set_tick_params(which='minor', size=7, width=2, direction='in', top='off')
    ax1.yaxis.set_tick_params(which='major', size=10, width=2, direction='in', right='off')
    ax1.yaxis.set_tick_params(which='minor', size=7, width=2, direction='in', right='off')
    
    ax2.spines['right'].set_visible(False)
    ax2.spines['top'].set_visible(False)
    
    ax2.xaxis.set_tick_params(which='major', size=10, width=2, direction='in', top='off')
    ax2.xaxis.set_tick_params(which='minor', size=7, width=2, direction='in', top='off')
    ax2.yaxis.set_tick_params(which='major', size=10, width=2, direction='in', right='off')
    ax2.yaxis.set_tick_params(which='minor', size=7, width=2, direction='in', right='off')

    
    # SETUP TEST CASE
    # ---------------
    # Set URL for testcase
    # url = 'http://127.0.0.1:5000'
    alfalfa = AlfalfaClient(url='http://localhost')
    

    # Set simulation parameters
    #length = 365 * 24 * 3600

    #step = 7200

    #simStartTime = 3 * 24 * 3600
    #warmupPeriod = 30 * 24 * 3600
    
    # Denver weather
    # 1/1/2019 00:00:00  - Note that we have to start at 1/1 right now.
    datetime.datetime(2017, 1, 1, 0, 0, 0)
    start_time = datetime.datetime(2017, 1, 3, 0, 0, 0)
    end_time = datetime.datetime(2017, 12, 31, 23, 59, 59)

    step = 300  
    sim_steps = int((end_time - start_time).total_seconds() / step)  # total time (in seconds) / 5 minute steps

    # ---------------


    # GET TEST INFORMATION
    # --------------------


    # RUN TEST CASE
    # -------------
    # Reset test case

    print('Initializing the simulation.')
    
   
    # Initialize u
    u = initializeControls()
    
    file = os.path.join(os.path.dirname(__file__), 'files', 'wrapped.fmu')
    print(f"Uploading test case {file}")
    site1 = alfalfa.submit(file)
    site2 = alfalfa.submit(file)
    site3 = alfalfa.submit(file)
    site4 = alfalfa.submit(file)
    print('Starting simulation')
    # all simulations start at time = 0 right now.
    #alfalfa.stop(site)
    alfalfa.start(
        site1,
        external_clock="true",
        end_datetime=365*24*3600
    )
    alfalfa.start(
        site2,
        external_clock="true",
        end_datetime=365*24*3600
    )
    alfalfa.start(
        site3,
        external_clock="true",
        end_datetime=365*24*3600
    )
    alfalfa.start(
        site4,
        external_clock="true",
        end_datetime=365*24*3600
    )


    print('Stepping through time')
    
    print('\nRunning controller script...')
    # Simulation Loop
    y = {
    'time' : 0,
    'senDay_y' : 1,
    'senHouDec_y' : 0,
    'senTRoom1_y' : 273.15+21,
    'senTemOA_y' : 273.15
    }

    for i in range(sim_steps):
        #current_time = start_time + datetime.timedelta(seconds=(i * step))
        
        current_time = ((start_time - datetime.datetime(2017, 1, 1, 0, 0, 0)).total_seconds()+ (i * step) )/3600
        alfalfa.setInputs(site1, u)
        alfalfa.setInputs(site2, u)
        alfalfa.setInputs(site3, u)
        alfalfa.setInputs(site4, u)
        for j in range(int(step/300)):
            alfalfa.advance([site1, site2, site3, site4])
        y = alfalfa.outputs(site1)
                
        if y == None:
            print('\n ERROR: Simulation failed')
            break
        y['time'] = i * step
        
        print(y)
        u = RuleBased(y)
        livePlot(0, y, u)
        
    plt.show()    
        #pltVals = livePlot(y, u)
         
        
        #add live plot update
    alfalfa.stop(site1)
    alfalfa.stop(site2)
    alfalfa.stop(site3)
    alfalfa.stop(site4)
    print('\nTest case complete.')
    # -------------

    # POST PROCESS RESULTS
    # --------------------
    # Get result data

    res = requests.get('{0}/results'.format(url)).json()
    time = [x / 3600 / 24 for x in res['y']['time']]  # convert s --> hr
    loSet = [21.0 if (res['y']['senDay_y'][i] <= 5 and 8 <= res['y']['senHou_y'][i] < 18) or (
                res['y']['senDay_y'][i] == 6 and 8 <= res['y']['senHou_y'][i] < 18) else 15.6 for i in range(len(res['y']['time']))]
    hiSet = [24.0 if (res['y']['senDay_y'][i] <= 5 and 8 <= res['y']['senHou_y'][i] < 18) or (
                res['y']['senDay_y'][i] == 6 and 8 <= res['y']['senHou_y'][i] < 18) else 26.7 for i in range(len(res['y']['time']))]
    TZone = [x - 273.15 for x in res['y']['senTRoom_y']]  # convert K --> C
    TZone1 = [x - 273.15 for x in res['y']['senTRoom1_y']]  # convert K --> C
    TZone2 = [x - 273.15 for x in res['y']['senTRoom2_y']]  # convert K --> C
    TZone3 = [x - 273.15 for x in res['y']['senTRoom3_y']]  # convert K --> C
    TZone4 = [x - 273.15 for x in res['y']['senTRoom4_y']]  # convert K --> C
    TOA = [x - 273.15 for x in res['y']['senTemOA_y']]  # convert K --> C
    PHeat = res['y']['senHeaPow_y']
    PHeat1 = res['y']['senHeaPow1_y']
    PHeat2 = res['y']['senHeaPow2_y']
    PHeat3 = res['y']['senHeaPow3_y']
    PHeat4 = res['y']['senHeaPow4_y']
    PCool = res['y']['senCCPow_y']
    PCool1 = res['y']['senCCPow1_y']
    PCool2 = res['y']['senCCPow2_y']
    PCool3 = res['y']['senCCPow3_y']
    PCool4 = res['y']['senCCPow4_y']
    PFan = res['y']['senFanPow_y']
    PFan1 = res['y']['senFanPow1_y']
    PFan2 = res['y']['senFanPow2_y']
    PFan3 = res['y']['senFanPow3_y']
    PFan4 = res['y']['senFanPow4_y']

    # Print KPIs

    kpi = requests.get('{0}/kpi'.format(url)).json()
    print('\nKPI RESULTS \n-----------')
    for key in kpi.keys():
        if key == 'tdis_tot':
            unit = 'Kh'
        if key == 'idis_tot':
            unit = 'ppmh'
        elif key == 'ener_tot':
            unit = 'kWh'
        elif key == 'cost_tot':
            unit = 'euro or $'
        elif key == 'emis_tot':
            unit = 'kg CO2'
        elif key == 'time_rat':
            unit = ''
        else:
            unit = ''
        print('{0}: {1} {2}'.format(key, kpi[key], unit))

    # Plot results
    
    results = [time, loSet, hiSet, TZone, TZone1, TZone2, TZone3, TZone4, TOA, PHeat, PHeat1, PHeat2, PHeat3, PHeat4,
               PCool, PCool1, PCool2, PCool3, PCool4, PFan, PFan1, PFan2, PFan3, PFan4]
    results = list(map(list, zip(*results)))
    with open('wrapped_results.csv', mode='w') as resultsFile:
        resultsWriter = csv.writer(resultsFile, delimiter=',')
        for line in range(len(results)):
            resultsWriter.writerow(results[line])

    

    # --------------------

    return res

def initializeControls():
    '''Initialize the control input u.

    Parameters
    ----------
    None

    Returns
    -------
    u : dict
        Defines the control input to be used for the next step.
        {<input_name> : <input_value>}

    '''

    u = {'oveHCSet_u': 0,
         'oveHCSet_activate': 0,
         'oveHCSet1_u': 0,
         'oveHCSet1_activate': 0,
         'oveHCSet2_u': 0,
         'oveHCSet2_activate': 0,
         'oveHCSet3_u': 0,
         'oveHCSet3_activate': 0,
         'oveHCSet4_u': 0,
         'oveHCSet4_activate': 0,
         'oveCC_u': 0,
         'oveCC_activate': 0,
         'oveCC1_u': 0,
         'oveCC1_activate': 0,
         'oveCC2_u': 0,
         'oveCC2_activate': 0,
         'oveCC3_u': 0,
         'oveCC3_activate': 0,
         'oveCC4_u': 0,
         'oveCC4_activate': 0,
         'oveDSet_u': 0,
         'oveDSet_activate': 0,
         'oveDSet1_u': 0,
         'oveDSet1_activate': 0,
         'oveDSet2_u': 0,
         'oveDSet2_activate': 0,
         'oveDSet3_u': 0,
         'oveDSet3_activate': 0,
         'oveDSet4_u': 0,
         'oveDSet4_activate': 0,
         'oveVFRSet_u': 0.35,
         'oveVFRSet_activate': 0,
         'oveVFRSet1_u': 0.35,
         'oveVFRSet1_activate': 0,
         'oveVFRSet2_u': 0.35,
         'oveVFRSet2_activate': 0,
         'oveVFRSet3_u': 0.35,
         'oveVFRSet3_activate': 0,
         'oveVFRSet4_u': 0.35,
         'oveVFRSet4_activate': 0,
         'oveHeaSet_u': 273.15+21,
         'oveHeaSet_activate': 0,
         'oveHeaSet1_u': 273.15+21,
         'oveHeaSet1_activate': 0,
         'oveHeaSet2_u': 273.15+21,
         'oveHeaSet2_activate': 0,
         'oveHeaSet3_u': 273.15+21,
         'oveHeaSet3_activate': 0,
         'oveHeaSet4_u': 273.15+21,
         'oveHeaSet4_activate': 0,
         'oveCooSet_u': 273.15+24,
         'oveCooSet_activate': 0,
         'oveCooSet1_u': 273.15+24,
         'oveCooSet1_activate': 0,
         'oveCooSet2_u': 273.15+24,
         'oveCooSet2_activate': 0,
         'oveCooSet3_u': 273.15+24,
         'oveCooSet3_activate': 0,
         'oveCooSet4_u': 273.15+24,
         'oveCooSet4_activate': 0, 
         'oveZero_u' : 1,
         'oveZero_activate' : 0, 
         'oveZero1_u' : 1,
         'oveZero1_activate' : 0, 
         'oveZero2_u' : 1,
         'oveZero2_activate' : 0, 
         'oveZero3_u' : 1,
         'oveZero3_activate' : 0, 
         'oveZero4_u' : 1,
         'oveZero4_activate' : 0
         }

    return u

def RuleBased(y):
    
    '''Rule Based Controller for the Reference Small Office Building

    Parameters
    ----------
    y : dict
        Sensor meansurements from the previous simulation step
        {<sensor_name> : <sensor_value>}

    Returns
    -------
    u : dict
        Defines the control input to be used for the next step.
        {<input_name> : <input_value>}
        
        
        
    Available Sensors
    -----------------
    
    Zones:
    Core		South			West			North			East			Description		(Check P2 to P4 orientation)
    -------------------------------------------------------------------------------------------------------------------------------------------
    senTRoom_y		senTRoom1_y		senTRoom2_y		senTRoom3_y		senTRoom4_y		Indoor air temperature (K)
    senRH_y		senRH1_y		senRH2_y		senRH3_y		senRH4_y		Relative humidity (%)
    senHeaPow_y	senHeaPow1_y		senHeaPow2_y		senHeaPow3_y		senHeaPow4_y		Heating coil heat flow rate (W)
    senCCPow_y		senCCPow1_y		senCCPow2_y		senCCPow3_y		senCCPow4_y		Cooling coil power demand (W)
    senFanPow_y	senFanPow1_y		senFanPow2_y		senFanPow3_y		senFanPow4_y		Fan power demand (W)
    senFanVol_y	senFanVol1_y		senFanVol2_y		senFanVol3_y		senFanVol4_y		Supply air volumetric flow rate (m3/s)
    senOAVol_y		senOAVol1_y		senOAVol2_y		senOAVol3_y		senOAVol4_y		Outside air volumetric flow rate (m3/s)
    senPowCor_y	senPowPer1_y		senPowPer1_y		senPowPer1_y		senPowPer1_y		Total HVAC Power demand (W) - Attention: currently includes the Heating coil heat flow rate but no efficiency term. This gives the power demand with a 100% efficient gas furnace which is unrealistic. 
    
    Other sensors:
    
    senMin_y		Current minute (0 - 60)
    senHou_y		Current hour (0 - 23)
    senHouDec_y	Current time, decimal format (0.0 - 23.99)
    senDay_y		Current day (1 - 7, Monday to Sunday)
    senTemOA_y		Outside air temperature, dry bulb (K)
    
    
    Available Control Overrides
    ---------------------------
    
    ///////// 
    NOTE: All controls have a corresponding _activate flag that 
    must be set to 1 if you intend on overriding the control input, 
    or 0 if you do not wish to override it. For example, for 
    overriding 'oveVar_u' the user must set:
    u = {
        'oveVar_u': yourValue,
        'oveVar_activate' : 1
        }
    /////////
    
    
    Zones:
    Core		South			West			North			East			Description		(Check P2 to P4 orientation)
    -------------------------------------------------------------------------------------------------------------------------------------------
    oveHCSet_u		oveHCSet1_u		oveHCSet2_u		oveHCSet3_u		oveHCSet4_u		Heating coil modulating command (0.0 - 1.0)
    oveCC_u		oveCC1_u		oveCC2_u		oveCC3_u		oveCC4_u		Cooling coil on/off command (0 or 1)
    oveDSet_u		oveDSet1_u		oveDSet2_u		oveDSet3_u		oveDSet4_u		Mixing damper setpoint (0.0 - 1.0)
    oveHeaSet_u	oveHeaSet1_u		oveHeaSet2_u		oveHeaSet3_u		oveHeaSet4_u		Heating setpoint (K)
    oveCooSet_u	oveCooSet1_u		oveCooSet2_u		oveCooSet3_u		oveCooSet4_u		Cooling setpoint (K)
    
    EXPERIMENTAL:
    ex·per·i·men·tal, /ikˌsperəˈmen(t)l/, adjective, (of a new invention or product) based on untested ideas or techniques and >>not yet established or finalized<<.
    
    oveZero_u		oveZero1_u		oveZero2_u		oveZero3_u		oveZero4_u		Temporary zeroing of all control inputs
    oveVFRSet_u	oveVFRSet1_u		oveVFRSet2_u		oveVFRSet3_u		oveVFRSet4_u		Fan vol. flow rate setpoint (0.0 - 2.0) - USE WITH CAUTION
    
    

    '''
    
    # Initialization
    
    
    u = {'oveHCSet_u': 0,
         'oveHCSet_activate': 0,
         'oveHCSet1_u': 0,
         'oveHCSet1_activate': 0,
         'oveHCSet2_u': 0,
         'oveHCSet2_activate': 0,
         'oveHCSet3_u': 0,
         'oveHCSet3_activate': 0,
         'oveHCSet4_u': 0,
         'oveHCSet4_activate': 0,
         'oveCC_u': 0,
         'oveCC_activate': 0,
         'oveCC1_u': 0,
         'oveCC1_activate': 0,
         'oveCC2_u': 0,
         'oveCC2_activate': 0,
         'oveCC3_u': 0,
         'oveCC3_activate': 0,
         'oveCC4_u': 0,
         'oveCC4_activate': 0,
         'oveDSet_u': 0,
         'oveDSet_activate': 0,
         'oveDSet1_u': 0,
         'oveDSet1_activate': 0,
         'oveDSet2_u': 0,
         'oveDSet2_activate': 0,
         'oveDSet3_u': 0,
         'oveDSet3_activate': 0,
         'oveDSet4_u': 0,
         'oveDSet4_activate': 0,
         'oveVFRSet_u': 0.35,
         'oveVFRSet_activate': 0,
         'oveVFRSet1_u': 0.35,
         'oveVFRSet1_activate': 0,
         'oveVFRSet2_u': 0.35,
         'oveVFRSet2_activate': 0,
         'oveVFRSet3_u': 0.35,
         'oveVFRSet3_activate': 0,
         'oveVFRSet4_u': 0.35,
         'oveVFRSet4_activate': 0,
         'oveHeaSet_u': 273.15+21,
         'oveHeaSet_activate': 0,
         'oveHeaSet1_u': 273.15+21,
         'oveHeaSet1_activate': 0,
         'oveHeaSet2_u': 273.15+21,
         'oveHeaSet2_activate': 0,
         'oveHeaSet3_u': 273.15+21,
         'oveHeaSet3_activate': 0,
         'oveHeaSet4_u': 273.15+21,
         'oveHeaSet4_activate': 0,
         'oveCooSet_u': 273.15+24,
         'oveCooSet_activate': 0,
         'oveCooSet1_u': 273.15+24,
         'oveCooSet1_activate': 0,
         'oveCooSet2_u': 273.15+24,
         'oveCooSet2_activate': 0,
         'oveCooSet3_u': 273.15+24,
         'oveCooSet3_activate': 0,
         'oveCooSet4_u': 273.15+24,
         'oveCooSet4_activate': 0, 
         'oveZero_u' : 1,
         'oveZero_activate' : 0, 
         'oveZero1_u' : 1,
         'oveZero1_activate' : 0, 
         'oveZero2_u' : 1,
         'oveZero2_activate' : 0, 
         'oveZero3_u' : 1,
         'oveZero3_activate' : 0, 
         'oveZero4_u' : 1,
         'oveZero4_activate' : 0
         }
    return u

def livePlot(i, y, u):
    '''Generate a set of plots for a live view of the simulation. Not used for plotting final results, see plotter utility.

    Parameters
    ----------
    y : dict
        Results from the previous simulation step
    u : dict
        Control vector defined for the current step
    Returns
    -------
    plotVals : list
        Values to plot in the current live plot window. Nested list

    '''
    global plotVals
    global ax1, ax2
    dwinlen = 604800			#default window range set to one week of simulated time
    
    plotVals.append([y['time'], y['senTRoom1_y']-273.15, y['senTemOA_y']-273.15, y['senDay_y'], y['senHouDec_y']])
    windowLength = plotVals[-1][0] - plotVals[0][0]		# data range in seconds
    
    while windowLength > dwinlen:
    	plotVals.pop(0)
    	windowLength = plotVals[-1][0] - plotVals[0][0]
    lowerbound = []
    upperbound = []
    for i in range(len(plotVals)):
        lowerbound.append(21 if ((1<=plotVals[i][3]<=5 and 6.0<=plotVals[i][4]<=22.0) or (plotVals[i][3]==6 and 6.0<=plotVals[i][4]<=18.0)) else 15.6)
        upperbound.append(24 if ((1<=plotVals[i][3]<=5 and 6.0<=plotVals[i][4]<=22.0) or (plotVals[i][3]==6 and 6.0<=plotVals[i][4]<=18.0)) else 26.7)
    


    # REPLACE XS AND YS WITH DATA TO PLOT
    #ax1.clear()
    #    ax1.set_xticks(range(len(plotVals)), ['Monday' if plotVals[i][3] == 1 else 'Tuesday' if plotVals[i][3] == 2 else 'Wednesday' if plotVals[i][3] == 3 else 'Thursday' if plotVals[i][3] == 4 else'Friday' if plotVals[i][3] == 5 else 'Saturday' if plotVals[i][3] == 6 else 'Sunday' for i in range(len(plotVals))])
    ax1.set_xlim(plotVals[0][0]/3600/24, max(1+plotVals[0][0]/3600/24, plotVals[-1][0]/3600/24))
    ax1.set_ylim(15, 27)
    ax1.plot([vals[0]/3600/24 for vals in plotVals], [vals[1] for vals in plotVals], 'blue')
    ax1.fill_between([vals[0]/3600/24 for vals in plotVals], [-100 for i in range(len(plotVals))], lowerbound, color='green')
    ax1.fill_between([vals[0]/3600/24 for vals in plotVals], [100 for i in range(len(plotVals))], upperbound, color='green')
    #ax2.clear()
    ax2.set_xlim(plotVals[0][0]/3600/24, max(1+plotVals[0][0]/3600/24, plotVals[-1][0]/3600/24))
    ax2.set_ylim(min([vals[2] for vals in plotVals])-1, max(1, max([vals[2] for vals in plotVals]))+1)
    ax2.plot([vals[0]/3600/24 for vals in plotVals], [vals[2] for vals in plotVals], 'r')
    
    plt.pause(0.01)
    plt.draw()
    
    # Format plot

    return plotVals


if __name__ == "__main__":
    res = run()
