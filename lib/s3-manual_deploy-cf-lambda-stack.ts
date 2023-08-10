import {
  Stack, StackProps, aws_lambda as lambda,
  aws_cloudfront_origins as cfos, aws_s3_deployment as s3d,
  RemovalPolicy, CfnOutput, aws_certificatemanager as cm,
  aws_s3 as s3, aws_cloudfront as cloudfront
} from 'aws-cdk-lib';
import { Construct } from 'constructs';


export class S3ManualDeployCfLambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Cloudfront's Source bucket
    const webSource = new s3.Bucket(this, "WebSourceBucket", { removalPolicy: RemovalPolicy.DESTROY })

    // Manual deployment of local files when running 'cdk deploy' to S3 from an adjacent project folder
    const deployment = new s3d.BucketDeployment(this, "DeployUI", {
      destinationBucket: webSource, sources: [s3d.Source.asset('../interface/dist')],
    })

    //Cloudfront's origin access identity to access s3
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI", { comment: "Keys" })
    webSource.grantRead(oai)

    const cert = cm.Certificate.fromCertificateArn(this, "Cert", "THE ARN OF YOUR CERTIFICATE") // just make this in the console, in the us-east-1 region
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: ["app.mastersautomation.tech"], // your URL here
      defaultRootObject: "index.html",
      certificate: cert,
      defaultBehavior: {
        origin: new cfos.S3Origin(webSource, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      }
    });
    distribution.node.addDependency(deployment)

    const function1 = new lambda.Function(this, "Function", {
      code: lambda.Code.fromAsset('./lambda/function'),
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      environment: {
        ENV_VARS: "VAR_VALUES"
      }
    })
    const func1URL = function1.addFunctionUrl()

    new CfnOutput(this, "distribution URL", { value: distribution.distributionDomainName }) // make an alias record in your DNS service to this URL
    new CfnOutput(this, "FunctionURL1", { value: func1URL.url }) // 'API route' to access the function

  }
}
