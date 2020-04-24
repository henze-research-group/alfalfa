require 'json'

module OpenStudio
  module Alfalfa
    class Tagger

      def initialize

      end

      def create_uuid(dummyinput)
        return "r:#{OpenStudio.removeBraces(OpenStudio.createUUID)}"
      end

      def create_ref(id)
        #return string formatted for Ref (ie, "r:xxxxx") with uuid of object
        #return "r:#{id.gsub(/[\s-]/,'_')}"
        return "r:#{OpenStudio.removeBraces(id)}"
      end

      def create_ref_name(id)
        #return string formatted for Ref (ie, "r:xxxxx") with uuid of object
        return "r:#{id.gsub(/[\s-]/, '_')}"
      end

      def create_str(str)
        #return string formatted for strings (ie, "s:xxxxx")
        return "s:#{str}"
      end

      def create_num(str)
        #return string formatted for numbers (ie, "n:xxxxx")
        return "n:#{str}"
      end

      def create_ems_str(id)
        #return string formatted with no spaces or '-' (can be used as EMS var name)
        return "#{id.gsub(/[\s-]/, '_')}"
      end

      def create_point_timevars(outvar_time, siteRef)
        #this function will add haystack tag to the time-variables created by user.
        #the time-variables are also written to variables.cfg file to coupling energyplus
        #the uuid is unique to be used for mapping purpose
        #the point_json generated here caontains the tags for the tim-variables
        point_json = Hash.new
        #id = outvar_time.keyValue.to_s + outvar_time.name.to_s
        uuid = create_uuid("")
        point_json[:id] = uuid
        #point_json[:source] = create_str("EnergyPlus")
        #point_json[:type] = "Output:Variable"
        #point_json[:name] = create_str(outvar_time.name.to_s)
        #point_json[:variable] = create_str(outvar_time.name)
        point_json[:dis] = create_str(outvar_time.nameString)
        point_json[:siteRef] = create_ref(siteRef)
        point_json[:point] = "m:"
        point_json[:cur] = "m:"
        point_json[:curStatus] = "s:disabled"

        return point_json, uuid
      end

      # end of create_point_timevar

      def create_mapping_timevars(outvar_time, uuid)
        #this function will use the uuid generated from create_point_timevars(), to make a mapping.
        #the uuid is unique to be used for mapping purpose; uuid is the belt to connect point_json and mapping_json
        #the mapping_json below contains all the necessary tags
        mapping_json = Hash.new
        mapping_json[:id] = uuid
        mapping_json[:source] = "EnergyPlus"
        mapping_json[:name] = "EMS"
        mapping_json[:type] = outvar_time.nameString
        mapping_json[:variable] = ""

        return mapping_json
      end


      def create_point_uuid(type, id, siteRef, equipRef, floorRef, where, what, measurement, kind, unit)
        point_json = Hash.new
        uuid = create_uuid(id)
        point_json[:id] = uuid
        point_json[:dis] = create_str(id)
        point_json[:siteRef] = create_ref(siteRef)
        point_json[:equipRef] = create_ref(equipRef)
        point_json[:floorRef] = create_ref(floorRef)
        point_json[:point] = "m:"
        point_json["#{type}"] = "m:"
        point_json["#{measurement}"] = "m:"
        point_json["#{where}"] = "m:"
        point_json["#{what}"] = "m:"
        point_json[:kind] = create_str(kind)
        point_json[:unit] = create_str(unit)
        point_json[:cur] = "m:"
        point_json[:curStatus] = "s:disabled"
        return point_json, uuid
      end

      def create_point2_uuid(type, type2, id, siteRef, equipRef, floorRef, where, what, measurement, kind, unit)
        point_json = Hash.new
        uuid = create_uuid(id)
        point_json[:id] = uuid
        point_json[:dis] = create_str(id)
        point_json[:siteRef] = create_ref(siteRef)
        point_json[:equipRef] = create_ref(equipRef)
        point_json[:floorRef] = create_ref(floorRef)
        point_json[:point] = "m:"
        point_json["#{type}"] = "m:"
        point_json["#{type2}"] = "m:"
        point_json["#{measurement}"] = "m:"
        point_json["#{where}"] = "m:"
        point_json["#{what}"] = "m:"
        point_json[:kind] = create_str(kind)
        point_json[:unit] = create_str(unit)
        point_json[:cur] = "m:"
        point_json[:curStatus] = "s:disabled"
        return point_json, uuid
      end

      def create_controlpoint2(type, type2, id, uuid, siteRef, equipRef, floorRef, where, what, measurement, kind, unit)
        point_json = Hash.new
        point_json[:id] = create_ref(uuid)
        point_json[:dis] = create_str(id)
        point_json[:siteRef] = create_ref(siteRef)
        point_json[:equipRef] = create_ref(equipRef)
        point_json[:floorRef] = create_ref(floorRef)
        point_json[:point] = "m:"
        point_json["#{type}"] = "m:"
        point_json["#{type2}"] = "m:"
        point_json["#{measurement}"] = "m:"
        point_json["#{where}"] = "m:"
        point_json["#{what}"] = "m:"
        point_json[:kind] = create_str(kind)
        point_json[:unit] = create_str(unit)
        if type2 == "writable"
          point_json[:writeStatus] = "s:ok"
        end
        return point_json
      end

      def create_fan(id, name, siteRef, equipRef, floorRef, variable)
        point_json = Hash.new
        point_json[:id] = create_ref(id)
        point_json[:dis] = create_str(name)
        point_json[:siteRef] = create_ref(siteRef)
        point_json[:equipRef] = create_ref(equipRef)
        point_json[:floorRef] = create_ref(floorRef)
        point_json[:equip] = "m:"
        point_json[:fan] = "m:"
        if variable
          point_json[:vfd] = "m:"
          point_json[:variableVolume] = "m:"
        else
          point_json[:constantVolume] = "m:"
        end
        return point_json
      end

      def create_ahu(id, name, siteRef, floorRef)
        ahu_json = Hash.new
        ahu_json[:id] = create_ref(id)
        ahu_json[:dis] = create_str(name)
        ahu_json[:ahu] = "m:"
        ahu_json[:hvac] = "m:"
        ahu_json[:equip] = "m:"
        ahu_json[:siteRef] = create_ref(siteRef)
        ahu_json[:floorRef] = create_ref(floorRef)
        return ahu_json
      end

      def create_vav(id, name, siteRef, equipRef, floorRef)
        vav_json = Hash.new
        vav_json[:id] = create_ref(id)
        vav_json[:dis] = create_str(name)
        vav_json[:hvac] = "m:"
        vav_json[:vav] = "m:"
        vav_json[:equip] = "m:"
        vav_json[:equipRef] = create_ref(equipRef)
        vav_json[:ahuRef] = create_ref(equipRef)
        vav_json[:siteRef] = create_ref(siteRef)
        vav_json[:floorRef] = create_ref(floorRef)
        return vav_json
      end

      def create_mapping_output_uuid(emsName, uuid)
        json = Hash.new
        json[:id] = create_ref(uuid)
        json[:source] = "Ptolemy"
        json[:name] = ""
        json[:type] = ""
        json[:variable] = emsName
        return json
      end

      def create_EMS_sensor_bcvtb(outVarName, key, emsName, uuid, report_freq, model)
        outputVariable = OpenStudio::Model::OutputVariable.new(outVarName, model)
        outputVariable.setKeyValue("#{key.name.to_s}")
        outputVariable.setReportingFrequency(report_freq)
        outputVariable.setName(outVarName)
        outputVariable.setExportToBCVTB(true)

        sensor = OpenStudio::Model::EnergyManagementSystemSensor.new(model, outputVariable)
        sensor.setKeyName(key.handle.to_s)
        sensor.setName(create_ems_str(emsName))

        json = Hash.new
        json[:id] = uuid
        json[:source] = "EnergyPlus"
        json[:type] = outVarName
        json[:name] = key.name.to_s
        json[:variable] = ""
        return sensor, json
      end

      #will get deprecated by 'create_EMS_sensor_bcvtb' once Master Algo debugged (dont clutter up the json's with unused points right now)
      def create_EMS_sensor(outVarName, key, emsName, report_freq, model)
        outputVariable = OpenStudio::Model::OutputVariable.new(outVarName, model)
        outputVariable.setKeyValue("#{key.name.to_s}")
        outputVariable.setReportingFrequency(report_freq)
        outputVariable.setName(outVarName)
        sensor = OpenStudio::Model::EnergyManagementSystemSensor.new(model, outputVariable)
        sensor.setKeyName(key.handle.to_s)
        sensor.setName(create_ems_str(emsName))
        return sensor
      end

      def tag_site(handle, name, floor_area, weather_ref, time_zone, city, state, country, lat, long)
        """
        create a haystack compliant site definition
        :params: an OS models building [handle, name, floor_area, weather_ref, time_zone, city, state, country, lat, long]
        :return: json representation of a haystack site definition
        """
        site = Hash.new
        site[:id] = create_ref(handle)
        site[:dis] = create_str(name.to_s)
        site[:site] = "m:"
        site[:area] = create_num(floor_area)
        site[:weatherRef] = create_ref(weather_ref)
        site[:tz] = create_num(time_zone)
        site[:geoCity] = create_str(city)
        site[:geoState] = create_str(state)
        site[:geoCountry] = create_str(country)
        site[:geoCoord] = "c:#{lat},#{long}"
        site[:simStatus] = "s:Stopped"
        site[:simType] = "s:osm"
        return site
      end

      def tag_weather(handle, city, time_zone, lat, long)
        """
        create a haystack compliant weather definition
        :params: an OS models building [handle, time_zone, city, lat, long]
        :return: json representation of a haystack weather definition
        """
        weather = Hash.new
        weather[:id] = create_ref(handle)
        weather[:dis] = create_str(city)
        weather[:weather] = "m:"
        weather[:tz] = create_num(time_zone)
        weather[:geoCoord] = "c:#{lat},#{long}"
        return weather
      end

      def tag_floor(handle)
        """
        create a haystack compliant weather definition
        :params: an OS models building Simulation Control handle
        :return: json representation of a haystack floor representation
        """
        floor = Hash.new
        floor[:id] = create_ref(handle)
        floor[:dis] = create_str("floor discription")
        floor[:floor] = "m:"
        return floor
      end

      def tag_sensor(o_handle, name, b_handle)
        """
        create a haystack compliant user defined sensor point from output variables
        :params: an OS models output variables hand, name, and building handle
        :return: json representation of a haystack sensor
        """
        sensor = Hash.new
        uuid = create_ref(o_handle)
        sensor[:id] = uuid
        sensor[:dis] = create_str(name)
        sensor[:siteRef] = create_ref(b_handle)
        sensor[:point]="m:"
        sensor[:cur]="m:"
        sensor[:curStatus] = "s:disabled"
        return sensor
      end

      def tag_writable_point(global, b_handle, uuid)
        """
        create a haystack compliant user defined writable points from output variables
        :params: an OS models output variables hand, name, and building handle
        :return: json representation of a haystack sensor
        """
        writable_point = Hash.new
        writable_point[:id] = uuid
        writable_point[:dis] = create_str(global)
        writable_point[:siteRef] = create_ref(b_handle)
        writable_point[:point]="m:"
        writable_point[:writable]="m:"
        writable_point[:writeStatus] = "s:ok"
        return writable_point
      end

      def tag_thermal_zones(model)
        """
        create a haystack compliant list of thermal zones
        :params: an OS model
        :return: json representation of a haystack thermal zone
        """
        thermal_zone_list = []
        thermal_zones = model.getThermalZones

        thermal_zones.each do |tz|
          if tz.name.is_initialized
            ## define haystack tagset here
            thermal_zone_haystack = Hash.new
            name = tz.name.get
            thermal_zone_haystack[:name] = "dis:"
            thermal_zone_haystack[:hvac] = "m:"
            thermal_zone_haystack[:zone] = "m:"
            thermal_zone_haystack[:space] = "m:"
            thermal_zone_list.push(thermal_zone_haystack)
          end
        end
        return thermal_zone_list
      end

      def tag_fans(model)
        """
        create a haystack compliant list of model fans
        :params: an OS model
        :return: json representation of a haystack fan
        """
        fan_list = []
        model.getAirLoopHVACs.each do |airloop|
          supply_components = airloop.supplyComponents
          #find AirLoopHVACOutdoorAirSystem on loop
          supply_components.each do |supply_component|
            if supply_component.to_AirLoopHVACOutdoorAirSystem.is_initialized
              #no fan?
            elsif supply_component.to_AirLoopHVACUnitarySystem.is_initialized
              sc = supply_component.to_AirLoopHVACUnitarySystem.get
              fan = sc.supplyFan
              if fan.is_initialized
                #AHU FAN equip
                if fan.get.to_FanVariableVolume.is_initialized
                  #puts("found VAV #{fan.get.name.to_s} on airloop #{airloop.name.to_s}")
                  vav_fan_json = create_fan(fan.get.handle, "#{fan.get.name.to_s}", building.handle, airloop.handle, simCon.handle, true)
                  fan_list.push(vav_fan_json)
                else
                  #puts("found CAV #{fan.get.name.to_s} on airloop #{airloop.name.to_s}")
                  cav_fan_json = create_fan(fan.get.handle, "#{fan.get.name.to_s}", building.handle, airloop.handle, simCon.handle, false)
                  fan_list.push(cav_fan_json)
                end
              end
            elsif supply_component.to_FanConstantVolume.is_initialized
              sc = supply_component.to_FanConstantVolume.get
              #puts("found #{sc.name.to_s} on airloop #{airloop.name.to_s}")
              fan_const_vol_json = create_fan(sc.handle, "#{sc.name.to_s}", building.handle, airloop.handle, simCon.handle, false)
              fan_list.push(fan_const_vol_json)
            elsif supply_component.to_FanVariableVolume.is_initialized
              sc = supply_component.to_FanVariableVolume.get
              #puts("found #{sc.name.to_s} on airloop #{airloop.name.to_s}")
              fan_variable_vol_json = create_fan(sc.handle, "#{sc.name.to_s}", building.handle, airloop.handle, simCon.handle, false)
              fan_list.push(fan_variable_vol_json)
            elsif supply_component.to_FanOnOff.is_initialized
              sc = supply_component.to_FanOnOff.get
              #puts("found #{sc.name.to_s} on airloop #{airloop.name.to_s}")
              fan_on_off_json = create_fan(sc.handle, "#{sc.name.to_s}", building.handle, airloop.handle, simCon.handle, false)
              fan_list.push(fan_on_off_json)
            end
          end
        end
      end
    end
  end
end
