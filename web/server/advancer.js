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
      if (message == 'Complete') {
        if (this.handlers.hasOwnProperty(channel)) {
          this.handlers[channel](message);
        }
      }
    });
  }

  advance(siteRefs) {
    let promise = new Promise((resolve, reject) => {
      let response = {};
      let pending = siteRefs.length;

      const advanceSite = (siteref) => {
        const channel = `site#${siteref}:notify`;
        const key = `site#${siteref}`;

        // Cleanup the resrouces for advance and finalize the promise
        let interval; 
        const finalize = (success, message='') => {
          delete this.handlers[channel]
          clearInterval(interval);
          this.sub.unsubscribe(channel);
          response[siteref] = { "status": success, "message": message };
          pending = pending - 1;
          if (! success) {
            console.error('Failed to advance site: ', siteref);
          }
          if (pending == 0) {
            resolve(response);
          }
        };

        const notify = () => {
          this.handlers[channel] = () => {
            finalize(true, 'success');
          };

          this.sub.subscribe(channel);
          this.pub.publish(channel, "Advance");

          // This is a failsafe in case we miss a message that step is complete
          //  If action is cleared assume, the step is done
          let intervalCounts = 0;
          interval = setInterval(() => {
            this.redis.hget(key, 'action', (err, action) => {
              if (action == null) {
                finalize(true, 'success');
              }
            });
            if (intervalCounts > 4) {
              finalize(false, 'no simulation reply');
            }
            intervalCounts = intervalCounts + 1;
          }, 1000);
        };

        // Put action field into "Advance" state
        this.redis.watch(key, (err) => {
          if (err) throw err;

          this.redis.hget(key, 'action', (err, action) => {
            if (err) throw err;
            // If there is an existing action then don't advance
            if (action == null) {
              // else proceed to advance state, this node has exclusive control over the simulation now
              this.redis.multi()
                .hset(key, "action", "Advance")
                .exec((err, results) => {
                  if (err) throw err;
                  notify();
                })
            } else {
              finalize(true, 'busy');
            }
          });
        });
      };

      for (var site of siteRefs) {
        advanceSite(site);      
      }
    });

    return promise;
  }
}

export {Advancer};

