import React from 'react';
import {withRouter} from 'react-router-dom';

import './Home.css';

class Home extends React.Component{
	constructor(props){
		super(props);
	}
	render() {
		return (
			<div>
				<h1>Welcome to the whyCloud <i style={{fontSize: '1rem'}}>Now powered by React</i></h1>
				<p>Use the top bar to navigate around</p>
			</div>
		);
	}
}

export default withRouter(Home);