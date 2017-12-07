import React from "react";
import {Link} from "react-router-dom";

import {ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend} from 'recharts';

import {Errors} from "../utils.js";

import "./BuildStatistics.css";

export default class BuildStatistics extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			hide: {}
		};
	}

	render(){
		const {proj} = this.props.match.params;
		const {language, list} = this.props.info.data;
		let diagram = null;
		if(language === "latex"){
			const data = list.map((v)=>{
									return {
										date: `${String(v.commit.date.getFullYear()).slice(-2)}/${v.commit.date.getMonth()+1}/${v.commit.date.getDate()} ${v.commit.ref.slice(0,7)}`,
										// ref: v.commit.ref,
										words: +v.build.stats.counts.words.total[0],
										letters: +v.build.stats.counts.letters.total[0],
										buildTime: Math.round(v.build.duration)
									}
									}).reverse();
			diagram = <LineChart data={data}>
							<XAxis dataKey="date"/>
							<YAxis label={{ value: 'Count', angle: -90, position: 'left', offset: -5 }} 
									orientation="left"
									yAxisId="counts"/>
							<YAxis label={{ value: 'Build Time (sec)', angle: -90, position: 'insideRight', offset: 20 }}
									orientation="right"
									yAxisId="time"/>
							<Tooltip/>
							<Legend onClick={(e)=>this.setState({hide: {...this.state.hide, [e.dataKey]: !e.inactive}})}/>
							<Line hide={this.state.hide["words"]}     dataKey="words"     type="monotone" stroke="#8884d8" yAxisId="counts" animationDuration={200}/>
							<Line hide={this.state.hide["letters"]}   dataKey="letters"   type="monotone" stroke="#82ca9d" yAxisId="counts" animationDuration={200}/>
							<Line hide={this.state.hide["buildTime"]} dataKey="buildTime" type="monotone" stroke="#ff7f0e" yAxisId="time"   animationDuration={200}/>
						</LineChart>
		}
		return (
		<div>
			<h1><Link to="." title="Go Back to List">{proj}</Link> &gt; Statistics</h1>
			<div className="buildStatistics">
				<div className="window">
					{
						diagram ? 
						<ResponsiveContainer width="100%" height="100%">
   							{diagram}
   						</ResponsiveContainer>
							:
						<Errors>No statistics available for your project</Errors>}
				</div>
			</div>
		</div>
		)
	}
};