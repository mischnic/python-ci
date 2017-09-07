import React from 'react';
import {NavLink, withRouter} from 'react-router-dom';

import {getUsername, logout} from '../auth.js';

import './Navigation.css';

import CustomLink from '../CustomLink.js';



class Navigation extends React.Component{
	constructor(props){
		super(props);

		this.state = {
			showUserDropdown: false
		};
		this.username = getUsername();
		this.clickListener = evt =>{
			if(this.state.showUserDropdown && !evt.target.closest('.user')){
				this.setState({showUserDropdown: false});
			}
		};
	}

	componentDidMount(){
		document.addEventListener('click', this.clickListener);
	}

	componentWillUnmount(){
		document.removeEventListener('click', this.clickListener);
	}

	render(){
		return (
			<div id="navigation">
				<div>
					{Object.keys(this.props.pages).map((v)=> <NavLink activeClassName='active' className='alignLeft' key={v.toLowerCase()} to={'/'+v.toLowerCase()+'/'}>{v}</NavLink> )}
					<div className='alignRight user'>
						<a onClick={()=>{this.setState({showUserDropdown: !this.state.showUserDropdown});}}>
							<i className="fa fa-arrow-down" style={{fontSize: '0.9rem'}}/>&thinsp;{this.username}
						</a>
						{this.state.showUserDropdown && (
							<div id="userDropdown" >
								<ul>
									<CustomLink type='li' to='/profile' onClick={()=>this.setState({showUserDropdown: false})}>
										Profile
									</CustomLink>
									<li onClick={()=>{logout();this.props.history.push('/');}}>
										Logout
									</li>
								</ul>
							</div>
						)}
					</div>
				</div>
			</div>);
	}
}


export default withRouter(Navigation);