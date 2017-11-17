import React from "react";
import {Link} from "react-router-dom";

import {Settings} from "../utils.js";

export default class SettingsPage extends React.Component {
	constructor(props){
		super(props);
		this.state = Settings.get();

		this.handleInputChange = this.handleInputChange.bind(this);
	}

	handleInputChange(event) {
		const target = event.target;
		const value = target.type === 'checkbox' ? target.checked : target.value;
		const name = target.name;

		this.setState({
			[name]: value
		}, () => Settings.set(name, value));
	}

	render(){
		return (
			<div>
				<h1><Link to="..">Projects</Link> > Settings</h1>
				<div className="settings">
					<h2>Log</h2>
					<label>Show expanded: <input name="expanded" type="checkbox" checked={this.state.expanded} onChange={this.handleInputChange}/></label>
				</div>
			</div>
		)
	}

};
