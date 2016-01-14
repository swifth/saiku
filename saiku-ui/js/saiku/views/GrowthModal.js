/*
 *   Copyright 2012 OSBI Ltd
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

/**
 * Dialog to calculate 'previous member' growth. Use case: if business users want to calculate difference between two periods, they can use this screen.
 */
var GrowthModal = Modal.extend({

	type: "filter",
	closeText: "Save",

	measureExpression: "",
	selectedMeasure: "",
	selectedDimension: "",
	asPercent: false,
	asPercentAround100: false,

	events: {
		'click .dialog_footer a': 'call',
		'submit form': 'save',
		'change #Measures': 'addMeasureToCalculationField',
		'change #Dimensions': 'addDimensionToCalculationField',
		'click [type="checkbox"]': 'setAbsoluteOrRelative'

	},

	buttons: [
		{text: "OK", method: "save"},
		{text: "Cancel", method: "close"}
	],

	addMeasureTemplate: _.template(
		"<span> Calculate difference of a measure over dimension members </span>" +
		"<form id='measureGrowthForm'>" +
		"<table border='0px'>" +
		"<tr><td class='col0 i18n'>Name:</td>" +
		"<td class='col1'><input type='text' class='form-control measure_name' value='Measure Name'></input></td></tr>" +

		'<input type="checkbox" name="asPercent" value="asPercent" id="asPercentCheckbox"> Relative %? <br>' +
		'<input type="checkbox" name="asPercentAround100" value="asPercentAround100" id="asPercentAround100Checkbox"> Relative around 100%? <br>' +

		"<tr><td class='col0 i18n'>Measure:</td>" +
		"<td class='col1'>" +
		"<select id='Measures' class='form-control' name='MeasuresId' title='Select the measure from which the difference should be calculated'> " +
		"    <option value='' selected='selected'>--select an existing measure--</option> " +
		"    <% _(measures).each(function(m) { %> " +
		"      <option value='<%= m.uniqueName %>'><%= m.name %></option> " +
		"    <% }); %> " +
		"</select> " +
		"</td></tr>" +

		"<tr><td class='col0 i18n'>Dimension:</td>" +
		"<td class='col1'>" +
		"<select id='Dimensions' name='DimensionsId' class='form-control' title='This dimension attribute is used to calculate the difference of the selected measure. E.g. Calculate the growth over the years.'> " +
		"    <option value='' selected='selected'>--select a dimension from your query--</option> " +
		"    <% _(dimensions).each(function(dim) { %> " +
		"      <option value='<%= dim %>'><%= dim %></option> " +
		"    <% }); %> " +
		"</select> " +
		"</td></tr>" +

		"<tr><td class='col0 i18n'>Format:</td>" +
		"<td class='col1'><input class='measure_format' type='text' class='form-control' value='#,##0.00'></input></td></tr>" +

		"<tr><td class='col0 i18n'>Formula:</td>" +
		"<td class='col1'><textarea class='measureFormula auto-hint' class='form-control' placeholder='This field will automatically be constructed by selecting a measure and growth dimension from the dropdown lists above...'>" +
		"</textarea></td></tr>" +

		"</table></form>"
	),

	initialize: function (args) {
		var self = this;
		this.measures = args.measures;
		this.dimensions = args.dimensions;
		this.workspace = args.workspace

		_.bindAll(this, "save", "addMeasureToCalculationField", "addDimensionToCalculationField", "updateCalculatedMemberField", "setAbsoluteOrRelative", "updateFormatField");

		// fix event listening in IE < 9
		if (isIE && isIE < 9) {
			$(this.el).find('form').on('submit', this.save);
		}

		// Load template
		this.message = this.addMeasureTemplate({
			measures: this.measures,
			dimensions: this.dimensions,
			measureExpression: this.measureExpression
		});

		this.$el.find('.dialog_icon')

	},

	save: function (event) {
		event.preventDefault();
		var self = this;
		var measure_name = $(this.el).find('.measure_name').val();
		var measure_formula = $(this.el).find('.measureFormula').val();
		var measure_format = $(this.el).find('.measure_format').val();


		var alert_msg = "";
		if (typeof measure_name == "undefined" || !measure_name) {
			alert_msg += "You have to enter a name for the measure! ";
		}
		if (typeof measure_formula == "undefined" || !measure_formula || measure_formula === "") {
			alert_msg += "You have to enter a MDX formula for the calculated measure! ";
		}
		if (alert_msg !== "") {
			alert(alert_msg);
		} else {
			var m = {name: measure_name, formula: measure_formula, properties: {}, uniqueName: "[Measures]." + measure_name};
			if (measure_format) {
				m.properties.FORMAT_STRING = measure_format;
			}
			self.workspace.query.helper.addCalculatedMeasure(m);
			self.workspace.sync_query();
			this.close();
		}

		return false;
	},

	updateCalculatedMemberField: function () {
		var measure = "[Measures]." + this.surroundWithSquareBrackets(this.selectedMeasure);
		var dimIteration = this.selectedDimension + ".CurrentMember.PrevMember";
		if (this.asPercent) {
			this.measureExpression = "( IIF( IsEmpty(" + dimIteration + "),NULL, " + "( " + measure + " - (" + measure + ", " + dimIteration + ")" + ") / " + "( " + measure + ", " + dimIteration + ")))";
		}
		else if (this.asPercentAround100) {
			this.measureExpression = "( IIF( IsEmpty(" + dimIteration + "),NULL, " + "1 + ( " + measure + " - (" + measure + ", " + dimIteration + ")" + ") /" +
				" " + "( " + measure + ", " + dimIteration + ")))";
		}
		else {
			this.measureExpression = "( IIF( IsEmpty(" + dimIteration + "),NULL, " + "( " + measure + " - " + "( " + measure + ", " + dimIteration + "))))";
		}

		// also update UI
		$(".measureFormula").val(this.measureExpression);
	},

	addMeasureToCalculationField: function (event) {
		this.selectedMeasure = this.$("#Measures option:selected").text();
		this.updateCalculatedMemberField();
	},

	addDimensionToCalculationField: function (event) {
		this.selectedDimension = this.$("#Dimensions option:selected").text();
		this.updateCalculatedMemberField();

	},

	setAbsoluteOrRelative: function (event) {
		var checkBox = event.target.id;
		if (checkBox == "asPercentCheckbox") {
			this.asPercent = !this.asPercent;
			this.asPercentAround100 = false;
		} else if (checkBox == "asPercentAround100Checkbox") {
			this.asPercentAround100 = !this.asPercentAround100;
			this.asPercent = false;
		}
		// keep DOM up-to-date
		$('#asPercentCheckbox').prop('checked', this.asPercent);
		$('#asPercentAround100Checkbox').prop('checked', this.asPercentAround100);
		this.updateCalculatedMemberField();
		this.updateFormatField();
	},

	updateFormatField: function (event) {
		if (this.asPercent || this.asPercentAround100) {
			$(".measure_format").val("0.00%");
		}
	},

	surroundWithSquareBrackets: function (text) {
		return '[' + text + ']';
	}

});