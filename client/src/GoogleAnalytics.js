import React from 'react';
import { withRouter } from 'react-router-dom';


class GoogleAnalytics extends React.Component {
  componentWillUpdate ({ location, history }) {

    console.log('sadsadasda')

    if (location.pathname === this.props.location.pathname) {
      // don't log identical link clicks (nav links likely)
      return;
    }

    if (history.action === 'PUSH' && typeof(window.ga) === 'function') {
      window.ga('set', 'page', location.pathname + location.search);
      window.ga('send', 'pageview');
    }
  }

  render () {
    return (
      <div>ASDASDASDD</div>
    );
  }
}

export default withRouter(GoogleAnalytics);