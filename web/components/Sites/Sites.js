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

import React, { PropTypes } from 'react';
import {FileUpload, MoreVert, ExpandLess, ExpandMore} from '@material-ui/icons';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import Grid from '@material-ui/core/Grid';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import CircularProgress from '@material-ui/core/CircularProgress';
import Checkbox from '@material-ui/core/Checkbox';
import { withStyles } from '@material-ui/core/styles';
import StartDialog from '../StartDialog/StartDialog.js';
import AutoSizer from "react-virtualized-auto-sizer";
import Box from '@material-ui/core/Box';

//class PointDialogComponent extends React.Component {
//
//  //handleRequestClose = () => {
//  //  this.props.onClosePointsClick();
//  //}
//
//  state = {
//    expanded: null,
//  };
//
//  handleChange = pointId => (event, expanded) => {
//    this.setState({
//      expanded: expanded ? pointId : false,
//    });
//  };
//
//  table = () => {
//    if( this.props.data.networkStatus === 1 ) { // 1 for loading https://www.apollographql.com/docs/react/api/react-apollo.html#graphql-query-data-networkStatus
//      return (
//        <Grid container justify="center" alignItems="center">
//          <Grid item><CircularProgress/></Grid>
//        </Grid>
//      );
//    } else {
//      const points = this.props.data.viewer.sites[0].points;
//      const { expanded } = this.state;
//      return(
//      <div>
//        {
//          points.map((point,i) => {
//            return (
//              <ExpansionPanel key={i} expanded={expanded === i} onChange={this.handleChange(i)}>
//                <ExpansionPanelSummary expandIcon={<ExpandMore />}>
//                  <Typography>{point.dis}</Typography>
//                </ExpansionPanelSummary>
//                <ExpansionPanelDetails>
//                  <Table>
//                    <TableHead>
//                      <TableRow>
//                        <TableCell>Key</TableCell>
//                        <TableCell>Value</TableCell>
//                      </TableRow>
//                    </TableHead>
//                    <TableBody>
//                        {point.tags.map((tag) => {
//                           return (
//                            <TableRow key={tag.key}>
//                              <TableCell>{tag.key}</TableCell>
//                              <TableCell>{tag.value}</TableCell>
//                            </TableRow>
//                           );
//                        })}
//                    </TableBody>
//                  </Table>
//                </ExpansionPanelDetails>
//              </ExpansionPanel>
//            )
//          })
//        }
//      </div>
//      );
//    }
//  }
//
//  render = () => {
//    if( this.props.site ) {
//      return(
//        <div>
//          <Dialog fullWidth={true} maxWidth='lg' open={true} onBackdropClick={this.props.onBackdropClick}>
//            <DialogTitle>{this.props.site.name + ' Points'}</DialogTitle>
//            <DialogContent>
//              {this.table()}
//            </DialogContent>
//          </Dialog>
//        </div>
//      )
//    } else {
//      return (<div></div>);
//    }
//  }
//}
//
//const pointsQL = gql`
//  query PointsQuery($siteRef: String!) {
//    viewer {
//      sites(siteRef: $siteRef) {
//        points {
//          dis
//          tags {
//            key
//            value
//          }
//        }
//      }
//    }
//  }
//`;
//
//const PointDialog = graphql(pointsQL, {
//  options: (props) => {
//    let siteRef = "";
//    if( props.site ) {
//      siteRef = props.site.siteRef;
//    }
//    return ({
//      pollInterval: 1000,
//      variables: {
//        siteRef
//      }
//    })
//  }
//})(PointDialogComponent);

class Sites extends React.Component {

  state = {
    selected: [],
    disabled: true,
    startDialogType: 'osm'
  };

  isSelected = (id) => {
    return this.state.selected.indexOf(id) !== -1;
  };

  handleRowClick = (event, id) => {
    const { selected } = this.state;
    const models = this.props.data.viewer.models;
    const selectedIndex = selected.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1),
      );
    }

    let simType = 'osm';
    if (newSelected.length > 0) {
      simType = models.find((m) => {return m.id == newSelected[0]}).info.type;
    }

    this.setState({ selected: newSelected, startDialogType: simType });
  };

  onSelectAllClick = () => {
    let simType = 'osm';
    const models = this.props.data.viewer.models;

    let all = [];
    console.log(this.state.selected.length);
    console.log(models.length);
    if (this.state.selected.length < models.length) {
      all = models.map((m) => {return m.id});
      console.log(all);
      simType = models[0].info.type;
    }
    this.setState({ selected: all, startDialogType: simType });
  };

  handleStartSimulation = (startDatetime,endDatetime,timescale,realtime,externalClock) => {
    this.selectedModels().map((item) => {
      this.props.startSimProp(item.id,startDatetime,endDatetime,timescale,realtime,externalClock);
    })
  }

  handleStopSimulation = () => {
    this.selectedModels().map((item) => {
      this.props.stopSimProp(item.id);
    })
  }

  handleRemoveModel = () => {
    this.selectedModels().map((item) => {
      this.props.removeModelProp(item.id);
    })
  }

  selectedModels = () => {
    return this.props.data.viewer.models.filter((model) => {
      return this.state.selected.some((id) => {
        return (id === model.id);
      })
    });
  }

  handleRequestShowPoints = (e, model) => {
    this.setState({ showModel: model });
    e.stopPropagation();
  }

  handleRequestClosePoints = () => {
    this.setState({ showModel: null });
  }

  formatTime = (isotime) => {
    let result = "";
    
    //check if it is ISO format
    if ( ! isotime ) {
      result = "-"
    } else if ( (isotime.split("-").length === 3 ) ){
      //is arr_isotime.length==3, it means it is ISO format
      // Haystack has an extra string representation of the timezone
      // tacked onto the end of the iso time string (after a single space)
      // Here we remove that extra timezone designation
      
      const _isotime = isotime.replace(/\s[\w]*/,'');
      // Use these options do show year and day of week
      //const options = {  
      //    weekday: "long", year: "numeric", month: "short",  
      //    day: "numeric", hour: "2-digit", minute: "2-digit"  
      //};  
      // For now keep it simple 
     
      const options = {  
          month: "short",  
          day: "numeric", hour: "2-digit", minute: "2-digit"  
      };  
      const datetime = new Date(_isotime);
      result = datetime.toLocaleTimeString("en-us", options);
    } else {
      result = isotime;
    } 
    
    return result;
  }

  showModelRef = () => {
    if( this.state.showModel ) {
      return this.state.showModel.id;
    } else {
      return "";
    }
  }

  render = (props) => {
    const { classes } = this.props;

    if( this.props.data.networkStatus === 1 ) { // 1 for loading https://www.apollographql.com/docs/react/api/react-apollo.html#graphql-query-data-networkStatus
      return null;
    } else {
      const models = this.props.data.viewer.models;
      return (
        <Box display="flex" flexDirection="column" flex={1}>
          <Box flexGrow={1}>
              <Table>
                <TableHead className={classes.head}>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={models.length > 0 &&  models.length < this.state.selected.length}
                        checked={models.length > 0 && models.length === this.state.selected.length}
                        onChange={this.onSelectAllClick}
                        inputProps={{ 'aria-label': 'Select all Models' }}
                      />
                    </TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Id</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                  <TableBody>
                    {this.props.data.viewer.models.map((model, i) => {
                       const isSelected = this.isSelected(model.id);
                       return (
                        <TableRow key={model.id} 
                          selected={false}
                          onClick={event => this.handleRowClick(event, model.id)} 
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                             checked={isSelected}
                            />
                          </TableCell>
                          <TableCell padding="none">{model.info.name}</TableCell>
                          <TableCell>{model.id}</TableCell>
                          <TableCell>{model.sim.state}</TableCell>
                          <TableCell>{this.formatTime(model.sim.time)}</TableCell>
                          <TableCell><IconButton><MoreVert/></IconButton></TableCell>
                        </TableRow>
                       );
                    })}
                  </TableBody>
              </Table>
          </Box>
          <Box flexShrink={1} className={classes.foot}>
            <Grid className={classes.controls} container justify="flex-start" alignItems="center" >
              <Grid item>
                <StartDialog type={this.state.startDialogType} onStartSimulation={this.handleStartSimulation}></StartDialog>
              </Grid>
              <Grid item>
                <Button variant="contained" className={classes.button} onClick={this.handleStopSimulation}>Stop Test</Button>
              </Grid>
              <Grid item>
                <Button variant="contained" className={classes.button} onClick={this.handleRemoveModel}>Remove Test Case</Button>
              </Grid>
            </Grid>
          </Box>
        </Box>
      );
    }
  }
}

const styles = theme => ({
  controls: {
    marginLeft: 16,
  },
  button: {
    margin: theme.spacing(1),
  },  
  head: {
    backgroundColor: "#fff",
    position: "sticky",
    top: 0
  },
  foot: {
    backgroundColor: "#fff",
    position: "sticky",
    bottom: 0
  }
});

const sitesQL = gql`
  query QueueQuery {
    viewer {
      username,
      models {
        id,
        info {
          name,
          type
        },
        sim {
          state,
          time,
          step
        }
      }
    }
  }
`;

// TODO: make an input type
const runSiteQL = gql`
  mutation runSiteMutation($siteRef: String!, $startDatetime: String, $endDatetime: String, $timescale: Float, $realtime: Boolean, $externalClock: Boolean ) {
    runSite(siteRef: $siteRef, startDatetime: $startDatetime, endDatetime: $endDatetime, timescale: $timescale, realtime: $realtime, externalClock: $externalClock)
  }
`;

const stopSiteQL = gql`
  mutation stopSiteMutation($siteRef: String!) {
    stopSite(siteRef: $siteRef)
  }
`;

const removeSiteQL = gql`
  mutation removeSiteMutation($siteRef: String!) {
    removeSite(id: $siteRef)
  }
`;

const withStyle = withStyles(styles)(Sites);

const withStart = graphql(runSiteQL, {
  props: ({ mutate }) => ({
    startSimProp: (siteRef, startDatetime, endDatetime, timescale, realtime, externalClock) => mutate({ variables: { siteRef, startDatetime, endDatetime, timescale, realtime, externalClock } }),
  })
})(withStyle);

const withStop = graphql(stopSiteQL, {
  props: ({ mutate }) => ({
    stopSimProp: (siteRef) => mutate({ variables: { siteRef } }),
  })
})(withStart);

const withRemove = graphql(removeSiteQL, {
  props: ({ mutate }) => ({
    removeModelProp: (siteRef) => mutate({ variables: { siteRef } }),
  })
})(withStop);

const withSites = graphql(sitesQL, {
  options: { 
    pollInterval: 1000,
  },
})(withRemove) 

export default withSites;

