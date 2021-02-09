function processData(dataCSV, countryCSV) {
  const data = Array.from(
    d3.rollup(
      dataCSV.filter((d) => !["WLD", "OECD", "BRICS"].includes(d.LOCATION)),
      (v) => {
        return v.reduce((d, e) => {
          d[e.SUBJECT.toLowerCase()] = +e.Value;
          return d;
        }, {});
      },
      (d) => d.LOCATION
    ),
    ([key, value]) => ({
      code: key,
      value,
    })
  );
  data.forEach((d) => {
    d.name = countryCSV.find((e) => e["Alpha-3 code"] === d.code).Country;
    d.icon = `assets/icons/${d.name.toLowerCase().replace(/ /g, "-")}.svg`;
  });
  return data;
}

class RadioToggleButtonGroup {
  constructor({ el, title, name, options, selectedValue, onChange }) {
    this.el = el;
    this.title = title;
    this.name = name;
    this.options = options;
    this.selectedValue = selectedValue;
    this.onChange = onChange;
    this.init();
  }

  init() {
    const container = d3.select(this.el);
    container.append("div").attr("class", "label").text(this.title);
    const btnGroup = container.append("div").attr("class", "btn-group");
    this.options.forEach((option, i) => {
      btnGroup
        .append("input")
        .attr("type", "radio")
        .attr("class", "btn-check")
        .attr("name", this.name)
        .attr("id", `${this.name}-${i + 1}`)
        .attr("value", option.value)
        .attr("checked", option.value === this.selectedValue ? "checked" : null)
        .on("change", () => {
          this.onChange(option.value);
        });
      btnGroup
        .append("label")
        .attr("class", "btn")
        .attr("for", `${this.name}-${i + 1}`)
        .text(option.text);
    });
  }
}

class StackedBarChart {
  constructor({ el, data, countLabel, percentageLabel }) {
    this.el = el;
    this.data = data
      .slice()
      .sort((a, b) =>
        d3.descending(
          d3.sum(Object.values(a.value)),
          d3.sum(Object.values(b.value))
        )
      );
    this.stackKeys = Object.keys(this.data[0].value);
    this.stacks = {
      // https://observablehq.com/@mkfreeman/separated-bar-chart
      separated: (series, order) => {
        if (!((n = series.length) > 1)) return;
        // Standard series
        for (
          var i = 1, s0, s1 = series[order[0]], n, m = s1.length;
          i < n;
          ++i
        ) {
          (s0 = s1), (s1 = series[order[i]]);
          let base = d3.max(s0, (d) => d[1]); // here is where you calculate the maximum of the previous layer
          for (var j = 0; j < m; ++j) {
            // Set the height based on the data values, shifted up by the previous layer
            let diff = s1[j][1] - s1[j][0];
            s1[j][0] = base;
            s1[j][1] = base + diff;
          }
        }
      },
      stacked: d3.stackOffsetNone,
      percentage: d3.stackOffsetExpand,
    };
    this.yLabels = {
      separated: countLabel,
      stacked: countLabel,
      percentage: percentageLabel,
    };
    this.initVis();
  }

  initVis() {
    const vis = this;
    vis.margin = {
      top: 24,
      right: 8,
      bottom: 48,
      left: 48,
    };
    vis.width = 960;
    vis.height = 480;

    vis.x = d3
      .scaleBand()
      .domain(vis.data.map((d) => d.code))
      .range([vis.margin.left, vis.width - vis.margin.right])
      .paddingInner(0.2)
      .paddingOuter(0.1);
    vis.y = d3
      .scaleLinear()
      .range([vis.height - vis.margin.bottom, vis.margin.top]);

    vis.container = d3.select(vis.el);
    vis.svg = vis.container
      .append("svg")
      .attr("viewBox", [0, 0, vis.width, vis.height]);
    vis.gx = vis.svg.append("g").attr("class", "axis");
    vis.gy = vis.svg.append("g").attr("class", "axis");
    vis.gs = vis.svg.selectAll("g.series");
  }

  wrangleData() {
    const vis = this;
    vis.displayData = d3.stack().offset(vis.stack).keys(vis.stackKeys)(
      vis.data.map((d) => d.value)
    );
    vis.y.domain([0, d3.max(vis.displayData, (d) => d3.max(d, (d) => d[1]))]);
    console.log(vis.displayData);
    vis.updateVis();
  }

  updateVis() {
    const vis = this;
    vis.gx
      .attr("transform", `translate(0,${vis.height - vis.margin.bottom})`)
      .call(d3.axisBottom(vis.x))
      .attr("font-size", null)
      .attr("font-family", null)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick")
          .selectAll("image")
          .data((d, i) => [vis.data[i].icon])
          .join("image")
          .attr("x", -vis.x.bandwidth() / 2)
          .attr("y", 20)
          .attr("width", vis.x.bandwidth())
          .attr("height", vis.x.bandwidth())
          .attr("href", (d) => d)
      );
    vis.gy
      .attr("transform", `translate(${vis.margin.left},0)`)
      .call(d3.axisLeft(vis.y))
      .attr("font-size", null)
      .attr("font-family", null)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".title")
          .data([vis.yLabel], (d) => d)
          .join("text")
          .attr("class", "title")
          .attr("fill", "currentColor")
          .attr("x", -vis.margin.left)
          .attr("y", vis.margin.top - 12)
          .attr("text-anchor", "start")
          .text((d) => d)
      );
    vis.gs = vis.gs
      .data(vis.displayData, (d) => d.key)
      .join("g")
      .attr("class", (d) => `series ${d.key}`)
      .attr("fill", "currentColor");
    vis.gs
      .selectAll("rect")
      .data((d) => d)
      .join((enter) =>
        enter
          .append("rect")
          .attr("x", (d, i) => vis.x(vis.data[i].code))
          .attr("y", vis.y.range()[0])
          .attr("height", 0)
          .attr("width", vis.x.bandwidth())
      )
      .transition()
      .duration(1000)
      .delay((d, i) => i * 50)
      .attr("x", (d, i) => vis.x(vis.data[i].code))
      .attr("y", (d) => vis.y(d[1]))
      .attr("height", (d) => vis.y(d[0]) - vis.y(d[1]))
      .attr("width", vis.x.bandwidth());
  }

  onStackChange(stack) {
    this.stack = this.stacks[stack];
    this.yLabel = this.yLabels[stack];
    this.wrangleData();
  }
}

Promise.all([
  d3.csv("assets/data/meat-consumption.csv"),
  d3.csv("assets/data/country-codes.csv"),
])
  .then(([dataCSV, countryCSV]) => {
    const data = processData(dataCSV, countryCSV);
    console.log(data);

    const dispatch = d3.dispatch("stackchange");
    const stackOptions = [
      { value: "stacked", text: "Stacked" },
      { value: "separated", text: "Separated" },
      { value: "percentage", text: "Percentage" },
    ];
    let selectedStackOption = stackOptions[0].value;
    new RadioToggleButtonGroup({
      el: document.querySelector("#stack-toggle"),
      title: "Choose stacking",
      name: "stack-option",
      options: stackOptions,
      selectedValue: selectedStackOption,
      onChange: (value) => dispatch.call("stackchange", null, value),
    });

    const stackedBarChart = new StackedBarChart({
      el: document.querySelector("#chart-container"),
      data,
      countLabel: "Kilograms per Capita",
      percentageLabel: "Proportion",
    });

    dispatch.on("stackchange", (value) => {
      stackedBarChart.onStackChange(value);
    });

    dispatch.call("stackchange", null, selectedStackOption);
  })
  .catch((error) => {
    console.error(error);
  });
