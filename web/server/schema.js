/***********************************************************************************************************************
*  Copyright (c) 2008-2018, Alliance for Sustainable Energy, LLC, and other contributors. All rights reserved.
*
*  Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
*  following conditions are met:
*
*  (1) Redistributions of source code must retain the above copyright notice, this list of conditions and the following
*  disclaimer.
*
*  (2) Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
*  disclaimer in the documentation and/or other materials provided with the distribution.
*
*  (3) Neither the name of the copyright holder nor the names of any contributors may be used to endorse or promote products
*  derived from this software without specific prior written permission from the respective party.
*
*  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER(S) AND ANY CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
*  INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
*  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER(S), ANY CONTRIBUTORS, THE UNITED STATES GOVERNMENT, OR THE UNITED
*  STATES DEPARTMENT OF ENERGY, NOR ANY OF THEIR EMPLOYEES, BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
*  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF
*  USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
*  STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
*  ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
***********************************************************************************************************************/

import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';

import resolvers from './resolvers';
import dbops from './lib/dbops';

var modelInfoType = new GraphQLObjectType({
  name: 'ModelInfo',
  description: 'Static information about a model',
  fields: () => ({
    name: {
      type: GraphQLString,
      description: 'The name of the model'
    },
    type: {
      type: GraphQLString,
      description: 'The type of simulation, osm or fmu'
    },
  })
});

var modelSimType = new GraphQLObjectType({
  name: 'ModelState',
  description: 'The realtime information about a simulating model',
  fields: () => ({
    state: {
      type: GraphQLString,
      description: 'The status of the site simulation'
    },
    time: {
      type: GraphQLString,
      description: 'The current simulation time'
    },
    step: {
      type: GraphQLString,
      description: 'The current simulation step'
    },
  })
});

var modelType = new GraphQLObjectType({
  name: 'Model',
  description: 'A model uploaded by user',
  fields: () => ({
    id: {
      type: GraphQLString,
      description: 'A unique identifier, corresponding to the haystack siteRef value'
    },
    info: {
      type: modelInfoType,
      description: 'Static informtion about the model',
      resolve: (obj,args,context) => {
        return resolvers.modelInfoResolver(obj, args, context);
      }
    },
    sim: {
      type: modelSimType,
      description: 'The realtime state related to a simulating model',
      resolve: (obj,args,context) => {
        return resolvers.modelSimResolver(obj, args, context);
      }
    }
  })
});

var simType = new GraphQLObjectType({
  name: 'Sim',
  description: 'A completed simulation, including any that may have stopped with errors.',
  fields: () => ({
    simRef: {
      type: GraphQLString,
      description: 'A unique identifier for the simulation'
    },
    siteRef: {
      type: GraphQLString,
      description: 'An identifier, corresponding to the haystack siteRef value'
    },
    simStatus: {
      type: GraphQLString,
      description: 'The simulation status.'
    },
    s3Key: {
      type: GraphQLString,
      description: 'The s3 key where the simulation point is located.'
    },
    name: {
      type: GraphQLString,
      description: 'The site name.'
    },
    url: {
      type: GraphQLString,
      description: 'This is a signed url to the file download.'
    },
    timeCompleted: {
      type: GraphQLString,
      description: 'The date and time when the simulation was completed.'
    },
    results: {
      type: GraphQLString,
      description: 'Key simulation results, Can be interpreted as json, html, plain text depending on job type and use case.'
    }
  })
});

var userType = new GraphQLObjectType({
  name: 'User',
  description: 'A person who uses our app',
  fields: () => ({
    //  id: globalIdField('User'),
    username: {
      type: GraphQLString,
      description: 'The username of a person', 
    },
    models: {
      type: new GraphQLList(modelType),
      description: 'Models that have been submitted by user', 
      args: {
        id: { type: GraphQLString },
        ids: { type: new GraphQLList(GraphQLString) }
      },
      resolve: (obj,args,context) => {
        return resolvers.modelsResolver(obj, args, context);
      }
    },
    sims: {
      type: new GraphQLList(simType),
      description: 'Completed simulations', 
      args: {
        siteRef: { type: GraphQLString },
        simRef: { type: GraphQLString }
      },
      resolve: (user,args,context) => {
        return resolvers.simsResolver(user,args,context);
      }
    }
  }),
});

var queryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    viewer: {
      type: userType,
      resolve: (_,args,request) => {return {username: 'smith'}},
    }
  }),
});

//const addJobMutation = new GraphQLObjectType({
//  name: 'AddJob',
//  type: GraphQLString,
//  args: {
//    modelFile : { type: new GraphQLNonNull(GraphQLString) },
//  },
//  resolve: (_,args,request) => {},
//});

const advanceResponseType = new GraphQLObjectType({
  name: 'AdvanceRespone',
  fields: () => ({
    id: { 
      type: GraphQLString,
      description: 'The models unique identifier'
    },
    step: {
      type: GraphQLString,
      description: 'The current simulation step after advancing'
    },
  })
});

const mutationType = new GraphQLObjectType({
  name: 'Mutations',
  fields: () => ({
    runSim: { 
      name: 'RunSim',
      type: GraphQLString,
      args: {
        uploadFilename : { type: new GraphQLNonNull(GraphQLString) },
        uploadID : { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (_,args,context) => {
        resolvers.runSimResolver(args.uploadFilename,args.uploadID,context);
      },
    },
    addSite: { 
      name: 'AddSite',
      type: GraphQLString,
      args: {
        osmName : { type: new GraphQLNonNull(GraphQLString) },
        uploadID : { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (_,args,context) => {
        return dbops.addSite(args, context);
      },
    },
    runSite: {
      name: 'RunSite',
      type: GraphQLString,
      args: {
        siteRef : { type: new GraphQLNonNull(GraphQLString) },
        startDatetime : { type: GraphQLString },
        endDatetime : { type: GraphQLString },
        timescale : { type: GraphQLFloat },
        realtime : { type: GraphQLBoolean },
        externalClock : { type: GraphQLBoolean },
      },
      resolve: (_,args,context) => {
        return dbops.runSite(args, context);
      },
    },
    stopSite: {
      name: 'StopSite',
      type: GraphQLString,
      args: {
        siteRef : { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (_,args,context) => {
        dbops.stopSite(args, context);
      },
    },
    removeSite: {
      name: 'removeSite',
      type: GraphQLString,
      args: {
        id : { type: GraphQLString },
        ids : { type: new GraphQLList(GraphQLString) }
      },
      resolve: (obj, args, context) => {
        resolvers.removeSiteResolver(obj, args, context);
      },
    },
    advance: {
      name: 'advance',
      type: new GraphQLList(advanceResponseType),
      args: {
        siteRefs : { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) }
      },
      resolve: (_,{siteRefs, time},{advancer}) => {
        return resolvers.advanceResolver(advancer, siteRefs);
      },
    },
    writePoint: {
      name: 'WritePoint',
      type: GraphQLString,
      args: {
        siteRef : { type: new GraphQLNonNull(GraphQLString) },
        pointName : { type: new GraphQLNonNull(GraphQLString) },
        value : { type: GraphQLFloat },
        level : { type: GraphQLInt }
      },
      resolve: (_,{siteRef, pointName, value, level},context) => {
        return resolvers.writePointResolver(context, siteRef, pointName, value, level);
      }
    }
  })
});

export var Schema = new GraphQLSchema({
  query: queryType,
  // Uncomment the following after adding some mutation fields:
  mutation: mutationType,
});

