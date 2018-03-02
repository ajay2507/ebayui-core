# ebay-carousel

## Usage

```marko
<ebay-carousel>
    <ebay-carousel-item>item 1</ebay-carousel-item>
    <ebay-carousel-item>item 2</ebay-carousel-item>
    <ebay-carousel-item>item 3</ebay-carousel-item>
    <ebay-carousel-item>item 4</ebay-carousel-item>
    <ebay-carousel-item>item 5</ebay-carousel-item>
</ebay-carousel>
```

## Attributes
Name | Type  | Description
--- | --- | ---
`type` | String | "continuous" (default) or "discrete"
`aria-label-prev` | String | aria-label for previous control
`aria-label-next` | String | aria-label for next control

## Properties
Name | Type | Description
--- | --- | ---
`index` | String | zero-based item position

## Events
Event | Description
--- | ---
`carousel-next` | click next control
`carousel-prev` | click previous control
`carousel-translate` | translate carousel content
