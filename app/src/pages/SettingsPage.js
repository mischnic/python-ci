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
					<a onClick={()=>this.props.history.goBack()}>{"<"}</a>  <Link to="..">Projects</Link> > Settings
				</h1>
				<div className="settings">
					<div>
						<h2>Log</h2>
						<label>
							Enable collapsible log commands
							<input name="enableLogExpansion" type="checkbox" checked={this.state.enableLogExpansion} onChange={this.handleInputChange}/>
						</label>
						<label>
							Autoexpand last command
							<input name="expandLast" type="checkbox" checked={this.state.expandLast} onChange={this.handleInputChange}/>
						</label>
						<label>
							Autoscroll during build
							<input disabled name="autoScroll" type="checkbox" checked={this.state.autoScroll} onChange={this.handleInputChange}/>
						</label>
					</div>
				</div>			
			</div>
		)
	}
});
