import React from "react";
import {Link, withRouter} from "react-router-dom";

import {Settings} from "../utils.js";
import "./SettingsPage.css";

export default withRouter(class SettingsPage extends React.Component {
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
				<h1>
					<a onClick={()=>this.props.history.goBack()}>{"<"}</a>  <Link to="..">Projects</Link> > Settings</h1>
				<div className="settings">
					<h2>Log</h2>
					<label>
						Enable collapsible log commands
						<input disabled={!window.matchMedia("(min-width: 660px)").matches} name="enableLogExpansion" type="checkbox" checked={this.state.enableLogExpansion} onChange={this.handleInputChange}/>
					</label>
					<label>
						Autoscroll during build
						<input name="autoScroll" type="checkbox" checked={this.state.autoScroll} onChange={this.handleInputChange}/>
					</label>
				</div>
			</div>
		)
	}

});
