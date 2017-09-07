import React from 'react';
import ReactDOM from 'react-dom';
import {BrowserRouter as Router, Route, Redirect, Switch} from 'react-router-dom';
import './index.css';

import registerServiceWorker from './registerServiceWorker';
import {isLoggedIn} from './auth.js';

import Login from './pages/Login.js';
import MenuPage from './pages/MenuPage.js';

import Home from './content/Home.js';
import Files from './content/Files';
import Profile from './content/Profile.js';


const pages = {
	'Home': Home,
	'Files': Files
};

function PrivateRoute({component: Component, authed = isLoggedIn, ...rest}) {
	return (
		<Route
			{...rest}
			render={(props) => authed()
				? <Component {...props} />
				: <Redirect to={{pathname: '/login', state: {from: props.location}}} />}
		/>
	);
}

if(isLoggedIn()) {
	isLoggedIn(true);
}

ReactDOM.render(
	<Router>
		<Switch>
			<Route path='/login' render={() => <Login/> } />
			<MenuPage pages={pages}>
				<Switch>
					<PrivateRoute path={'/files/:path*'} component={Files}/>
					<PrivateRoute path={'/home'} component={Home}/>
					<PrivateRoute path={'/profile'} component={Profile}/>
					<Redirect from='/' to='/files/'/>
				</Switch>
			</MenuPage>
		</Switch>
	</Router>, document.getElementById('root'));

registerServiceWorker();
