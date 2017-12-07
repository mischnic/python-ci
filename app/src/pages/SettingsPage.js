import React from "react";
import {Link, withRouter} from "react-router-dom";
import PropTypes from 'prop-types';

import {Settings} from "../utils.js";
import "./SettingsPage.css";

const Option = (props, context) =>
	<label>
		<span style={{userSelect: "none"}}>{props.children}</span>
		<input name={props.name} type={props.type} disabled={props.disabled} onChange={props.onChange}
				 {...{ [props.type==="checkbox" ? "checked" : "value"]: context.state[props.name] }}/>
	</label>

Option.contextTypes = {state: PropTypes.object};


export default withRouter(class SettingsPage extends React.Component {
	static childContextTypes = {
		state: PropTypes.object.isRequired
	};

	constructor(props){
		super(props);
		this.state = Settings.getFlat();

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

	getChildContext() {
		return {
			state: this.state
		};
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
						<Option name="log.enableLogExpansion" type="checkbox" onChange={this.handleInputChange}>
							Enable collapsible log commands
						</Option>
						<Option name="log.expandLast" type="checkbox" disabled={!this.state["log.enableLogExpansion"]} onChange={this.handleInputChange}>
							Autoexpand last command
						</Option>
						<Option name="log.autoScroll" type="checkbox" onChange={this.handleInputChange}>
							Autoscroll during build
						</Option>
					</div>
				</div>			
			</div>
		)
	}
});
