import React from 'react';
import {withRouter} from 'react-router-dom';
import {login, isLoggedIn} from '../auth.js';
import './Login.css';

class Login extends React.Component {
	constructor(props){
		super(props);
		this.state = {
			user: 'admin',
			password: 'niklas',
			message: false
		};
	}

	changeUser(event){
		this.setState({user: event.target.value});
	}

	changePassword(event){
		this.setState({password: event.target.value});
	}

	componentWillMount(){
		this.redirect();
	}

	redirect(){
		if(isLoggedIn()){
			var path = this.props.history.location.state ? this.props.history.location.state.from.pathname : '/';
			this.props.history.replace(path);
		}
	}

	tryLogin(event){
		event.preventDefault();
		login(this.state.user, this.state.password)
			.then(()=> this.redirect(), (res)=>{
				if(res.error === 'wrong'){
					this.setState({message: 'Wrong username or password'});
				}
			});
	}

	render(){
		return (
			<form id='login' onSubmit={(e)=>{this.tryLogin(e);}}>
				<div>Login</div>
				{this.state.message && <div style={{color: 'red', fontSize: '0.8em', textAlign: 'center', marginBottom: '0.5em'}}>{this.state.message}</div>}
				<div>
					<input value={this.state.user} onChange={(e)=>{this.changeUser(e);}} type='text' placeholder='Username / "guest"' required/>
					<i className="fa fa-user-o"/>
				</div>
				<div>
					<input value={this.state.password} onChange={(e)=>{this.changePassword(e);}} type='password' placeholder='Password'/>
					<span className="fa-stack" style={{position: 'absolute',top: '2px',left: '0px'}}>
						<i className="fa fa-circle fa-stack-2x" style={{fontSize: '1.4em','top': '7px'}}></i>
						<i className="fa fa-lock fa-inverse fa-stack-1x"/>
					</span>
				</div>
				<input type='submit' value="Login" />
			</form>
		);
	}
}

export default withRouter(Login);