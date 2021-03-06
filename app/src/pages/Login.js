import React from 'react';
import {withRouter} from 'react-router-dom';
import {login, isLoggedIn} from '../auth.js';
import './Login.css';

class Login extends React.Component {
	constructor(props){
		super(props);
		this.state = {
			user: 'user',
			password: '',
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
			console.log(this.props.history.location.state)
			var path = this.props.history.location.state ? this.props.history.location.state.from.pathname : '/';
			this.props.history.replace(path);
		}
	}

	tryLogin(event){
		event.preventDefault();
		login(this.state.user, this.state.password)
			.then(() => {
					if(this.props.afterLogin)
						this.props.afterLogin(this.state.user);
					this.redirect();
				}
				, (res) => {
				if(res.status === 401){
					this.setState({message: 'Wrong username or password'});
				} else {
					this.setState({message: 'An error occured'});
				}
			});
	}

	render(){
		return (
			<div className='login'>
				<h1>Login</h1>
				<div>
					<form onSubmit={(e)=>{this.tryLogin(e);}}>
						<div style={{color: 'red', fontSize: '0.8em', textAlign: 'center', marginBottom: '0.5em', height: "1em"}}>{this.state.message}</div>
						<div>
							<input  value={this.state.user}
									onChange={(e)=>{this.changeUser(e);}}
									type='text'
									placeholder='Username / "guest"'
									autoComplete='username' aria-label="Username"
									required disabled/>
							<i className="fa fa-user-o"/>
						</div>
						<div>
							<input  value={this.state.password}
									onChange={(e)=>{this.changePassword(e);}}
									type='password'
									placeholder='Password' aria-label="Password"
									autoComplete='current-password'
									autoFocus/>
							<span className="fa-stack">
								<i className="fa fa-circle fa-stack-2x" style={{fontSize: '1.3em'}}></i>
								<i className="fa fa-lock fa-inverse fa-stack-1x" style={{'top': '-7px'}}/>
							</span>
						</div>
						<input type='submit' value="Login" />
					</form>
				</div>
			</div>
		);
	}
}

export default withRouter(Login);