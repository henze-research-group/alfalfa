class Advancer {
  // This class pertains to advancing a simulation.
  //
  // The task is to notify the simulation worker of a (http) request to advance the simulation,
  // After notifying the simulation worker of a request to advance, the webserver must
  // wait for the simulation step to complete, and only then return a response to the http client.
  //
  // A redis database is used as the primary mechanism to 
  // communicate between the webserver and the simulation worker
  //
  // For each request to advance a simulation, communication involves
  // 1. A redis key of the form site#${siteRef}::action which can have the values [Advance | Stop]
  // 2. A request to advance can only be fulfilled if the site#${siteRef}::state key has the value "Running"
  // 3. A redis notification from the webserver on the channel "site#${siteRef}:advancer" with message "Advance"
  // 4. A redis notification from the worker on the channel "site#${siteRef}:advancer" with message "Complete", 
  //    signaling that the simulation is done advancing to the simulation
  // 5. When the step is done site#${siteRef}::action should have no value
  constructor(redis, pub, sub) {
    this.redis = redis;
    this.pub = pub;
    this.sub = sub;
    this.handlers = {};

    this.sub.on('message', (channel, message) => {
      message = JSON.parse(message) 
      if (message['notification'] == 'done') {
        if (this.handlers.hasOwnProperty(channel)) {
          this.handlers[channel](message);
        }
      }
    });
  }

  advance(siteRefs) {
    let promise = new Promise((resolve, reject) => {
      let response = [];
      let pending = siteRefs.length;

      const finalize = () => {
        clearTimeout(timeout);
        this.sub.unsubscribe();
        resolve(response);
      };

      let timeout = setTimeout(() => {
        finalize();
      }, 5000);

      let siteinfo = [];
      for (var siteref of siteRefs) {
        siteinfo.push({
          'siteref': siteref,
          'key': `model#${siteref}`,
          'channel': `model#${siteref}:notify`
        });
      }
      const channels = siteinfo.map((site) => {return site['channel']});

      for (let site of siteinfo) {
        const channel = site['channel'];
        const siteref = site['siteref'];
        this.handlers[channel] = (message) => {
          delete this.handlers[channel];
          this.sub.unsubscribe(channel);
          let notification, r;
          ({notification, ...r} = message);
          r['id'] = site['siteref'];
          response.push(r);
          pending = pending - 1;
          if (pending == 0) {
            finalize();
          }
        };
      }

      this.sub.subscribe(channels);

      for (let site of siteinfo) {
        const s = JSON.stringify({"notification": "advance"});
        this.pub.publish(site['channel'],s);
      }
    });

    return promise;
  }
}

export {Advancer};

