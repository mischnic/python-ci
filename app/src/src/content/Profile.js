import React from 'react';
import {withRouter} from 'react-router-dom';
import {getUsername} from '../auth.js';
import {api} from '../utils.js';
import ModalProvider, {withModals} from '../components/Modal.js';


class Profile extends React.Component{

	changePassword(){
		this.props.showModal(
		{
			title: ()=>'Change password',
			content: (f) => (
				<div>Please enter a new password: {ModalProvider.FORMS.PASSWORD('newPassword')(f)}
					<span style={{color: 'red', verticalAlign: 'middle', marginLeft: '0.5em'}}>{f.vars.message}</span>
				</div>
			),
			actions: [
				{
					name: 'Cancel',
					callback: ModalProvider.ACTIONS.CANCEL,
					onHide: true
				},
				{
					name: 'Ok',
					callback: ModalProvider.ACTIONS.OK,
					onSubmit: true
				}
			]
		}, {
			success: (formHandler)=> {
				let { newPassword = ''} = formHandler.form;
				if(newPassword.length < 6){
					formHandler.vars.message = 'Please enter a password with at least 6 characters!';
				}
				else if(newPassword.match(/.*password.*|123456/i)){
					formHandler.vars.message = 'Really?';
				} else {
					api(this, '/api/user/changePassword', {body: {newPassword}}, 'text')
						.then((res)=>{
							if(res == 'ok'){
								console.log(res);
								formHandler.close();
							}
						});
				}
				return false;
			}
		});
	}

	render() {
		return (
			<div>
				<h1>Hello, <i>{getUsername()}</i>!</h1>
				<h3>Account</h3>
				<button onClick={()=>this.changePassword()}>Change Password</button>
			</div>
		);
	}
}

export default withRouter(withModals(Profile));